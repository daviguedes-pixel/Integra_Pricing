-- 1. Add escalation_profiles to approval_margin_rules
ALTER TABLE public.approval_margin_rules 
ADD COLUMN IF NOT EXISTS escalation_profiles text[] DEFAULT '{}';

COMMENT ON COLUMN public.approval_margin_rules.escalation_profiles IS 'Array de perfis que devem aprovar em caso de rejeição pelos requeridos originais';

-- 2. Update get_approval_margin_rule to return the new column
DROP FUNCTION IF EXISTS public.get_approval_margin_rule(INTEGER);

CREATE OR REPLACE FUNCTION public.get_approval_margin_rule(margin_cents INTEGER)
RETURNS TABLE (
    id UUID,
    min_margin_cents INTEGER,
    max_margin_cents INTEGER,
    required_profiles TEXT[],
    escalation_profiles TEXT[],
    rule_name TEXT,
    priority_order INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT r.id, r.min_margin_cents, r.max_margin_cents,
           r.required_profiles, r.escalation_profiles, r.rule_name, r.priority_order
    FROM public.approval_margin_rules r
    WHERE r.is_active = true
        AND r.min_margin_cents <= margin_cents
        AND (r.max_margin_cents IS NULL OR r.max_margin_cents >= margin_cents)
    ORDER BY r.priority_order DESC, r.min_margin_cents DESC
    LIMIT 1;
END;
$$;

-- 3. Rewrite _find_next_approver to use ONLY margin rules
CREATE OR REPLACE FUNCTION public._find_next_approver(
    p_request_id uuid,
    p_created_by text,
    p_current_level integer,
    p_margin_cents integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_approval_rule record;
    v_required_profiles text[];
    v_escalation_profiles text[];
    v_next_profile text;
    v_next_user record;
    
    v_approved_profiles text[];
    v_rejected_profiles text[];
    v_acted_profiles text[];
    v_creator_uuid uuid;
BEGIN
    v_creator_uuid := public._resolve_user_id(p_created_by);

    -- Get the applicable margin rule
    SELECT * INTO v_approval_rule FROM public.get_approval_margin_rule(COALESCE(p_margin_cents, 0));
    v_required_profiles := COALESCE(v_approval_rule.required_profiles, ARRAY[]::text[]);
    v_escalation_profiles := COALESCE(v_approval_rule.escalation_profiles, ARRAY[]::text[]);

    -- Get profiles that have already approved
    SELECT COALESCE(array_agg(DISTINCT up.perfil), ARRAY[]::text[])
    INTO v_approved_profiles
    FROM public.approval_history ah
    JOIN public.user_profiles up ON up.user_id::text = ah.approver_id::text
    WHERE ah.suggestion_id = p_request_id
      AND ah.action = 'approved';

    -- Get profiles that have rejected (triggering escalation)
    SELECT COALESCE(array_agg(DISTINCT up.perfil), ARRAY[]::text[])
    INTO v_rejected_profiles
    FROM public.approval_history ah
    JOIN public.user_profiles up ON up.user_id::text = ah.approver_id::text
    WHERE ah.suggestion_id = p_request_id
      AND ah.action = 'rejected';

    -- All acted profiles to avoid selecting someone twice
    v_acted_profiles := array_cat(v_approved_profiles, v_rejected_profiles);

    -- Behavior if there was a rejection (Esclation Mode)
    IF array_length(v_rejected_profiles, 1) > 0 THEN
        IF array_length(v_escalation_profiles, 1) > 0 THEN
            FOREACH v_next_profile IN ARRAY v_escalation_profiles LOOP
                -- Skip if this profile has already acted (either approved or rejected)
                IF v_next_profile = ANY(v_acted_profiles) THEN CONTINUE; END IF;

                SELECT user_id, email, nome INTO v_next_user
                FROM public.user_profiles
                WHERE perfil = v_next_profile AND ativo = true
                  AND user_id::text != COALESCE(v_creator_uuid::text, '')
                LIMIT 1;

                IF v_next_user.user_id IS NOT NULL THEN
                    RETURN json_build_object(
                        'found', true, 'level', p_current_level + 1, 'profile', v_next_profile,
                        'user_id', v_next_user.user_id,
                        'user_name', COALESCE(v_next_user.nome, v_next_user.email, 'Perfil: ' || v_next_profile)
                    );
                END IF;
            END LOOP;
        END IF;
        
        -- If in escalation mode and no next escalation profile is found, request terminates (fully rejected/cannot escalate further)
        RETURN json_build_object('found', false);
    END IF;

    -- Normal Approval Mode (No rejections)
    IF array_length(v_required_profiles, 1) > 0 THEN
        FOREACH v_next_profile IN ARRAY v_required_profiles LOOP
            -- Skip if this profile has already acted
            IF v_next_profile = ANY(v_acted_profiles) THEN CONTINUE; END IF;

            SELECT user_id, email, nome INTO v_next_user
            FROM public.user_profiles
            WHERE perfil = v_next_profile AND ativo = true
              AND user_id::text != COALESCE(v_creator_uuid::text, '')
            LIMIT 1;

            IF v_next_user.user_id IS NOT NULL THEN
                RETURN json_build_object(
                    'found', true, 'level', p_current_level + 1, 'profile', v_next_profile,
                    'user_id', v_next_user.user_id,
                    'user_name', COALESCE(v_next_user.nome, v_next_user.email, 'Perfil: ' || v_next_profile)
                );
            END IF;
        END LOOP;
    END IF;

    -- If no next required profile is found, request terminates (fully approved)
    RETURN json_build_object('found', false);
END;
$$;


-- 4. Rewrite _can_profile_finalize mapping
CREATE OR REPLACE FUNCTION public._can_profile_finalize(
    p_profile text,
    p_suggestion_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request_margin integer;
    v_attachments text[];
    v_has_evidence boolean;
    v_approval_rule record;
    v_required_profiles text[];
    v_escalation_profiles text[];
    v_req_evidence boolean;
    v_max_disc_evidence_cents integer;
BEGIN
    SELECT margin_cents, attachments INTO v_request_margin, v_attachments
    FROM public.price_suggestions WHERE id = p_suggestion_id;

    v_has_evidence := (v_attachments IS NOT NULL AND array_length(v_attachments, 1) > 0);

    SELECT * INTO v_approval_rule FROM public.get_approval_margin_rule(COALESCE(v_request_margin, 0));
    v_required_profiles := COALESCE(v_approval_rule.required_profiles, ARRAY[]::text[]);
    v_escalation_profiles := COALESCE(v_approval_rule.escalation_profiles, ARRAY[]::text[]);

    -- Profile must be either in required_profiles or escalation_profiles to approve/reject
    IF array_length(v_required_profiles, 1) > 0 OR array_length(v_escalation_profiles, 1) > 0 THEN
        IF NOT (p_profile = ANY(array_cat(v_required_profiles, v_escalation_profiles))) THEN 
            RETURN false; 
        END IF;
    END IF;

    SELECT requires_evidence, max_discount_with_evidence_cents
    INTO v_req_evidence, v_max_disc_evidence_cents
    FROM public.profile_permissions WHERE perfil = p_profile;

    IF COALESCE(v_req_evidence, false) AND NOT v_has_evidence THEN RETURN false; END IF;

    IF COALESCE(v_req_evidence, false) AND v_has_evidence AND v_max_disc_evidence_cents IS NOT NULL THEN
        IF v_request_margin < (-1 * v_max_disc_evidence_cents) THEN RETURN false; END IF;
    END IF;

    RETURN true;
END;
$$;

NOTIFY pgrst, 'reload schema';
