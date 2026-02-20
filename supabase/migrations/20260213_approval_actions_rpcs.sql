-- Migration: Approval Actions RPCs Overhaul
-- Replaces approve/reject and adds suggest_price, request_justification, request_evidence
-- All RPCs: SECURITY DEFINER + audit trail + notifications + self-skip logic

-- ============================================================================
-- HELPER: Resolve user identifier (UUID string, email, or name) to actual UUID
-- ============================================================================
CREATE OR REPLACE FUNCTION public._resolve_user_id(p_identifier text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid;
BEGIN
    IF p_identifier IS NULL THEN RETURN NULL; END IF;
    
    -- 1. Try casting to UUID
    BEGIN
        v_id := p_identifier::uuid;
        RETURN v_id;
    EXCEPTION WHEN OTHERS THEN
        -- 2. Not a UUID, try to find in user_profiles by email prefix, full email or name
        SELECT user_id INTO v_id
        FROM public.user_profiles
        WHERE email = p_identifier 
           OR email LIKE p_identifier || '@%'
           OR nome = p_identifier
        LIMIT 1;
        
        RETURN v_id;
    END;
END;
$$;

-- ============================================================================
-- HELPER: Find next approver in chain, with self-skip and same-profile-skip
-- ============================================================================
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
    v_approval_order text[];
    v_approval_rule record;
    v_required_profiles text[];
    v_next_level integer;
    v_next_profile text;
    v_next_user record;
    v_already_acted_profiles text[];
    v_creator_uuid uuid;
BEGIN
    v_creator_uuid := public._resolve_user_id(p_created_by);

    -- Load approval order
    SELECT array_agg(perfil ORDER BY order_position ASC) INTO v_approval_order
    FROM public.approval_profile_order WHERE is_active = true;

    IF v_approval_order IS NULL OR array_length(v_approval_order, 1) = 0 THEN
        v_approval_order := ARRAY['analista_pricing', 'supervisor_comercial', 'diretor_comercial', 'diretor_pricing'];
    END IF;

    -- Load margin rule
    SELECT * INTO v_approval_rule FROM public.get_approval_margin_rule(p_margin_cents);
    v_required_profiles := COALESCE(v_approval_rule.required_profiles, ARRAY[]::text[]);

    -- Get profiles that already acted on this request
    SELECT COALESCE(array_agg(DISTINCT up.perfil), ARRAY[]::text[])
    INTO v_already_acted_profiles
    FROM public.approval_history ah
    JOIN public.user_profiles up ON up.user_id = ah.approver_id
    WHERE ah.suggestion_id = p_request_id
      AND ah.action IN ('approved', 'rejected');

    -- Walk the chain from current_level + 1 onward
    FOR i IN (p_current_level + 1)..array_length(v_approval_order, 1) LOOP
        v_next_profile := v_approval_order[i];

        -- Skip profiles that already acted (same cargo skip)
        IF v_next_profile = ANY(v_already_acted_profiles) THEN
            CONTINUE;
        END IF;

        -- If required_profiles is set, only consider those profiles
        IF array_length(v_required_profiles, 1) > 0 AND NOT (v_next_profile = ANY(v_required_profiles)) THEN
            CONTINUE;
        END IF;

        -- Find a user for this profile, skipping the request creator (self-skip)
        SELECT user_id, email, nome INTO v_next_user
        FROM public.user_profiles
        WHERE perfil = v_next_profile AND ativo = true 
          AND user_id != COALESCE(v_creator_uuid, '00000000-0000-0000-0000-000000000000'::uuid)
          AND email != COALESCE(p_created_by, '')
          AND nome != COALESCE(p_created_by, '')
        LIMIT 1;

        -- If no other user found, try to find ANY user (even the creator, as fallback for single-user profiles)
        IF v_next_user.user_id IS NULL THEN
            -- Check if there's someone else with same profile
            SELECT user_id, email, nome INTO v_next_user
            FROM public.user_profiles
            WHERE perfil = v_next_profile AND ativo = true
            LIMIT 1;

            -- If the only user IS the creator, skip this level entirely
            IF v_next_user.user_id = v_creator_uuid OR v_next_user.email = p_created_by OR v_next_user.nome = p_created_by THEN
                v_next_user := NULL;
                CONTINUE;
            END IF;
        END IF;

        IF v_next_user.user_id IS NOT NULL THEN
            v_next_level := i;
            RETURN json_build_object(
                'found', true,
                'level', v_next_level,
                'profile', v_next_profile,
                'user_id', v_next_user.user_id,
                'user_name', COALESCE(v_next_user.nome, v_next_user.email, 'Perfil: ' || v_next_profile)
            );
        END IF;
    END LOOP;

    -- No one found in the chain
    RETURN json_build_object('found', false);
END;
$$;

-- ============================================================================
-- HELPER: Check if user's profile can fully approve (has margin authority)
-- ============================================================================
CREATE OR REPLACE FUNCTION public._can_profile_finalize(
    p_user_profile text,
    p_margin_cents integer
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_approval_rule record;
    v_required_profiles text[];
BEGIN
    SELECT * INTO v_approval_rule FROM public.get_approval_margin_rule(p_margin_cents);

    IF v_approval_rule IS NULL THEN
        RETURN true; -- No rule = anyone can approve
    END IF;

    v_required_profiles := COALESCE(v_approval_rule.required_profiles, ARRAY[]::text[]);

    IF array_length(v_required_profiles, 1) = 0 THEN
        RETURN true; -- Empty required_profiles = anyone can approve
    END IF;

    RETURN p_user_profile = ANY(v_required_profiles);
END;
$$;


-- ============================================================================
-- 1. APPROVE PRICE REQUEST (rewritten)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.approve_price_request(
    p_request_id uuid,
    p_observations text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_permissions public.profile_permissions;
    v_approver_name text;
    v_current_level integer;
    v_can_finalize boolean;
    v_next_approver json;
BEGIN
    v_user_id := auth.uid();

    -- 1. Fetch & Validate
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    IF v_request.status != 'pending' THEN RAISE EXCEPTION 'Request is not pending approval'; END IF;

    -- 2. User Profile & Permissions
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE id = v_user_id;

    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN
        RAISE EXCEPTION 'User does not have approval permissions';
    END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_current_level := COALESCE(v_request.approval_level, 1);

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, v_approver_name, 'approved', v_current_level, p_observations
    );

    -- 4. Check if this profile can finalize (has margin authority)
    v_can_finalize := public._can_profile_finalize(v_profile.perfil, v_request.margin_cents);

    IF v_can_finalize THEN
        -- FINAL APPROVAL
        UPDATE public.price_suggestions
        SET status = 'approved',
            approved_by = v_user_id,
            approved_at = now(),
            current_approver_id = v_user_id,
            current_approver_name = v_approver_name,
            approvals_count = COALESCE(approvals_count, 0) + 1,
            last_approver_action_by = v_user_id
        WHERE id = p_request_id;

        -- Notify Requester
        IF v_request.created_by IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
            VALUES (
                public._resolve_user_id(v_request.created_by),
                'Solicitação Aprovada ✅',
                'Sua solicitação foi aprovada por ' || v_approver_name,
                'request_approved',
                p_request_id,
                false
            );
        END IF;

        RETURN json_build_object('success', true, 'status', 'approved');
    ELSE
        -- ESCALATE to next approver
        v_next_approver := public._find_next_approver(
            p_request_id, v_request.created_by, v_current_level, v_request.margin_cents
        );

        IF (v_next_approver->>'found')::boolean THEN
            UPDATE public.price_suggestions
            SET approval_level = (v_next_approver->>'level')::integer,
                current_approver_id = (v_next_approver->>'user_id')::uuid,
                current_approver_name = v_next_approver->>'user_name',
                approvals_count = COALESCE(approvals_count, 0) + 1,
                last_approver_action_by = v_user_id
            WHERE id = p_request_id;

            -- Notify next approver
            INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
            VALUES (
                (v_next_approver->>'user_id')::uuid,
                'Nova Aprovação Pendente',
                'Solicitação aguardando sua aprovação (Nível ' || (v_next_approver->>'level') || ')',
                'approval_pending',
                p_request_id,
                false
            );

            RETURN json_build_object('success', true, 'status', 'pending', 'nextLevel', (v_next_approver->>'level')::integer);
        ELSE
            -- No one else in chain → final approval by current user
            UPDATE public.price_suggestions
            SET status = 'approved',
                approved_by = v_user_id,
                approved_at = now(),
                current_approver_id = v_user_id,
                current_approver_name = v_approver_name,
                approvals_count = COALESCE(approvals_count, 0) + 1,
                last_approver_action_by = v_user_id
            WHERE id = p_request_id;

            IF v_request.created_by IS NOT NULL THEN
                INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
                VALUES (
                    public._resolve_user_id(v_request.created_by),
                    'Solicitação Aprovada ✅',
                    'Sua solicitação foi aprovada por ' || v_approver_name,
                    'request_approved',
                    p_request_id,
                    false
                );
            END IF;

            RETURN json_build_object('success', true, 'status', 'approved');
        END IF;
    END IF;
END;
$$;


-- ============================================================================
-- 2. REJECT PRICE REQUEST (rewritten — always escalates)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reject_price_request(
    p_request_id uuid,
    p_observations text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_approver_name text;
    v_current_level integer;
    v_next_approver json;
BEGIN
    v_user_id := auth.uid();

    -- 1. Fetch & Validate
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    IF v_request.status NOT IN ('pending') THEN RAISE EXCEPTION 'Request is not pending approval'; END IF;

    -- 2. User Profile
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_current_level := COALESCE(v_request.approval_level, 1);

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, v_approver_name, 'rejected', v_current_level, p_observations
    );

    -- 4. ALWAYS try to escalate
    v_next_approver := public._find_next_approver(
        p_request_id, v_request.created_by, v_current_level, v_request.margin_cents
    );

    IF (v_next_approver->>'found')::boolean THEN
        -- Escalate to next approver
        UPDATE public.price_suggestions
        SET status = 'pending',
            approval_level = (v_next_approver->>'level')::integer,
            current_approver_id = (v_next_approver->>'user_id')::uuid,
            current_approver_name = v_next_approver->>'user_name',
            rejections_count = COALESCE(rejections_count, 0) + 1,
            last_approver_action_by = v_user_id
        WHERE id = p_request_id;

        -- Notify next approver
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            (v_next_approver->>'user_id')::uuid,
            'Solicitação Escalada para Revisão',
            'Uma solicitação foi rejeitada por ' || v_approver_name || ' e escalada para sua revisão',
            'approval_pending',
            p_request_id,
            false
        );

        RETURN json_build_object('success', true, 'status', 'pending', 'action', 'escalated', 'nextLevel', (v_next_approver->>'level')::integer);
    ELSE
        -- No one else in chain → final rejection
        UPDATE public.price_suggestions
        SET status = 'rejected',
            approved_by = v_user_id,
            approved_at = now(),
            current_approver_id = NULL,
            current_approver_name = NULL,
            rejections_count = COALESCE(rejections_count, 0) + 1,
            last_approver_action_by = v_user_id
        WHERE id = p_request_id;

        -- Notify Requester
        IF v_request.created_by IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
            VALUES (
                public._resolve_user_id(v_request.created_by),
                'Solicitação Rejeitada ❌',
                'Sua solicitação foi rejeitada por ' || v_approver_name,
                'price_rejected',
                p_request_id,
                false
            );
        END IF;

        RETURN json_build_object('success', true, 'status', 'rejected', 'action', 'terminated');
    END IF;
END;
$$;


-- ============================================================================
-- 3. SUGGEST PRICE (new RPC)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.suggest_price_request(
    p_request_id uuid,
    p_suggested_price numeric,
    p_observations text DEFAULT NULL,
    p_arla_price numeric DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_permissions public.profile_permissions;
    v_approver_name text;
    v_current_level integer;
    v_price_cents integer;
    v_arla_cents integer;
BEGIN
    v_user_id := auth.uid();

    -- 1. Fetch & Validate
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    IF v_request.status NOT IN ('pending') THEN RAISE EXCEPTION 'Request is not pending approval'; END IF;

    IF p_suggested_price IS NULL OR p_suggested_price <= 0 THEN
        RAISE EXCEPTION 'Suggested price must be greater than 0';
    END IF;

    -- 2. User Profile & Permissions
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE id = v_user_id;

    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN
        RAISE EXCEPTION 'User does not have approval permissions';
    END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_current_level := COALESCE(v_request.approval_level, 1);
    v_price_cents := (p_suggested_price * 100)::integer;
    v_arla_cents := CASE WHEN p_arla_price IS NOT NULL THEN (p_arla_price * 100)::integer ELSE NULL END;

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, v_approver_name, 'price_suggested',
        v_current_level,
        COALESCE(p_observations, '') || ' | Preço sugerido: R$ ' || p_suggested_price::text
    );

    -- 4. Update request
    UPDATE public.price_suggestions
    SET status = 'price_suggested',
        suggested_price = v_price_cents,
        final_price = v_price_cents,
        arla_price = COALESCE(v_arla_cents, arla_price),
        current_approver_id = v_user_id,
        current_approver_name = v_approver_name,
        last_approver_action_by = v_user_id
    WHERE id = p_request_id;

    -- 5. Notify Requester
    IF v_request.created_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            public._resolve_user_id(v_request.created_by),
            'Preço Sugerido 💰',
            v_approver_name || ' sugeriu um novo preço para sua solicitação. Aceite ou recorra.',
            'price_suggested',
            p_request_id,
            false
        );
    END IF;

    RETURN json_build_object('success', true, 'status', 'price_suggested', 'suggestedPrice', p_suggested_price);
END;
$$;


-- ============================================================================
-- 4. REQUEST JUSTIFICATION (new RPC)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.request_justification(
    p_request_id uuid,
    p_observations text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_permissions public.profile_permissions;
    v_approver_name text;
    v_current_level integer;
BEGIN
    v_user_id := auth.uid();

    -- 1. Validate
    IF p_observations IS NULL OR trim(p_observations) = '' THEN
        RAISE EXCEPTION 'Observations are required when requesting justification';
    END IF;

    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    IF v_request.status NOT IN ('pending') THEN RAISE EXCEPTION 'Request is not pending approval'; END IF;

    -- 2. User Profile & Permissions
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE id = v_user_id;

    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN
        RAISE EXCEPTION 'User does not have approval permissions';
    END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_current_level := COALESCE(v_request.approval_level, 1);

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, v_approver_name, 'request_justification',
        v_current_level, p_observations
    );

    -- 4. Update request
    UPDATE public.price_suggestions
    SET status = 'awaiting_justification',
        last_approver_action_by = v_user_id
    WHERE id = p_request_id;

    -- 5. Notify Requester
    IF v_request.created_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            public._resolve_user_id(v_request.created_by),
            'Justificativa Solicitada 📝',
            v_approver_name || ' solicitou uma justificativa para sua solicitação de preço.',
            'justification_requested',
            p_request_id,
            false
        );
    END IF;

    RETURN json_build_object('success', true, 'status', 'awaiting_justification');
END;
$$;


-- ============================================================================
-- 5. REQUEST EVIDENCE (new RPC)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.request_evidence(
    p_request_id uuid,
    p_product text,
    p_observations text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_permissions public.profile_permissions;
    v_approver_name text;
    v_current_level integer;
BEGIN
    v_user_id := auth.uid();

    -- 1. Validate
    IF p_product NOT IN ('principal', 'arla') THEN
        RAISE EXCEPTION 'Product must be "principal" or "arla"';
    END IF;

    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    IF v_request.status NOT IN ('pending') THEN RAISE EXCEPTION 'Request is not pending approval'; END IF;

    -- 2. User Profile & Permissions
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE id = v_user_id;

    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN
        RAISE EXCEPTION 'User does not have approval permissions';
    END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_current_level := COALESCE(v_request.approval_level, 1);

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, v_approver_name, 'request_evidence',
        v_current_level,
        COALESCE(p_observations, '') || ' | Produto: ' || p_product
    );

    -- 4. Update request
    UPDATE public.price_suggestions
    SET status = 'awaiting_evidence',
        evidence_product = p_product,
        last_approver_action_by = v_user_id
    WHERE id = p_request_id;

    -- 5. Notify Requester
    IF v_request.created_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            public._resolve_user_id(v_request.created_by),
            'Referência Solicitada 📎',
            v_approver_name || ' solicitou uma referência de preço (' || 
            CASE WHEN p_product = 'principal' THEN 'Produto Principal' ELSE 'ARLA' END || ').',
            'evidence_requested',
            p_request_id,
            false
        );
    END IF;

    RETURN json_build_object('success', true, 'status', 'awaiting_evidence', 'evidenceProduct', p_product);
END;
$$;


-- ============================================================================
-- 6. PROVIDE JUSTIFICATION (requester responds — new RPC)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.provide_justification(
    p_request_id uuid,
    p_justification text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_requester_name text;
    v_last_approver_id uuid;
BEGIN
    v_user_id := auth.uid();

    -- 1. Validate
    IF p_justification IS NULL OR trim(p_justification) = '' THEN
        RAISE EXCEPTION 'Justification text is required';
    END IF;

    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    IF v_request.status != 'awaiting_justification' THEN RAISE EXCEPTION 'Request is not awaiting justification'; END IF;
    IF public._resolve_user_id(v_request.created_by) != v_user_id AND v_request.created_by != v_user_id::text THEN 
        RAISE EXCEPTION 'Only the requester can provide justification'; 
    END IF;

    -- 2. User name
    SELECT nome, email INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    v_requester_name := COALESCE(v_profile.nome, v_profile.email, 'Solicitante');

    v_last_approver_id := v_request.last_approver_action_by;

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, v_requester_name, 'justification_provided',
        v_request.approval_level, p_justification
    );

    -- 4. Return to pending at same level
    UPDATE public.price_suggestions
    SET status = 'pending'
    WHERE id = p_request_id;

    -- 5. Notify the approver who requested justification
    IF v_last_approver_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            v_last_approver_id,
            'Justificativa Recebida ✅',
            v_requester_name || ' respondeu à justificativa solicitada.',
            'justification_provided',
            p_request_id,
            false
        );
    END IF;

    RETURN json_build_object('success', true, 'status', 'pending');
END;
$$;


-- ============================================================================
-- 7. PROVIDE EVIDENCE (requester uploads — new RPC)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.provide_evidence(
    p_request_id uuid,
    p_attachment_url text,
    p_observations text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_requester_name text;
    v_last_approver_id uuid;
    v_current_attachments text[];
BEGIN
    v_user_id := auth.uid();

    -- 1. Validate
    IF p_attachment_url IS NULL OR trim(p_attachment_url) = '' THEN
        RAISE EXCEPTION 'Attachment URL is required';
    END IF;

    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    IF v_request.status != 'awaiting_evidence' THEN RAISE EXCEPTION 'Request is not awaiting evidence'; END IF;
    IF public._resolve_user_id(v_request.created_by) != v_user_id AND v_request.created_by != v_user_id::text THEN 
        RAISE EXCEPTION 'Only the requester can provide evidence'; 
    END IF;

    -- 2. User name
    SELECT nome, email INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    v_requester_name := COALESCE(v_profile.nome, v_profile.email, 'Solicitante');

    v_last_approver_id := v_request.last_approver_action_by;

    -- 3. Append attachment
    v_current_attachments := COALESCE(v_request.attachments, ARRAY[]::text[]);
    v_current_attachments := array_append(v_current_attachments, p_attachment_url);

    -- 4. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, v_requester_name, 'evidence_provided',
        v_request.approval_level,
        COALESCE(p_observations, 'Evidência anexada: ' || p_attachment_url)
    );

    -- 5. Update request
    UPDATE public.price_suggestions
    SET status = 'pending',
        attachments = v_current_attachments,
        evidence_product = NULL  -- Clear evidence request
    WHERE id = p_request_id;

    -- 6. Notify the approver who requested evidence
    IF v_last_approver_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            v_last_approver_id,
            'Referência Recebida ✅',
            v_requester_name || ' anexou a referência de preço solicitada.',
            'evidence_provided',
            p_request_id,
            false
        );
    END IF;

    RETURN json_build_object('success', true, 'status', 'pending');
END;
$$;


-- ============================================================================
-- 8. APPEAL PRICE (requester appeals suggested price — new RPC)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.appeal_price_request(
    p_request_id uuid,
    p_new_price numeric,
    p_observations text DEFAULT NULL,
    p_arla_price numeric DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_requester_name text;
    v_price_cents integer;
    v_arla_cents integer;
    v_first_approver json;
BEGIN
    v_user_id := auth.uid();

    -- 1. Validate
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    IF v_request.status != 'price_suggested' THEN RAISE EXCEPTION 'Request is not in price_suggested status'; END IF;
    IF public._resolve_user_id(v_request.created_by) != v_user_id AND v_request.created_by != v_user_id::text THEN 
        RAISE EXCEPTION 'Only the requester can appeal'; 
    END IF;

    -- Check appeal limit (max 1)
    IF COALESCE(v_request.appeal_count, 0) >= 1 THEN
        RAISE EXCEPTION 'Maximum number of appeals (1) reached. You must accept the suggested price.';
    END IF;

    IF p_new_price IS NULL OR p_new_price <= 0 THEN
        RAISE EXCEPTION 'New price must be greater than 0';
    END IF;

    -- 2. User name
    SELECT nome, email INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    v_requester_name := COALESCE(v_profile.nome, v_profile.email, 'Solicitante');

    v_price_cents := (p_new_price * 100)::integer;
    v_arla_cents := CASE WHEN p_arla_price IS NOT NULL THEN (p_arla_price * 100)::integer ELSE NULL END;

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, v_requester_name, 'appeal',
        1, -- Reset to level 1
        COALESCE(p_observations, '') || ' | Novo preço proposto: R$ ' || p_new_price::text
    );

    -- 4. Find first approver (reset to beginning of chain)
    v_first_approver := public._find_next_approver(
        p_request_id, v_request.created_by, 0, v_request.margin_cents
    );

    -- 5. Update request — reset to level 1 with new price
    UPDATE public.price_suggestions
    SET status = 'pending',
        final_price = v_price_cents,
        arla_price = COALESCE(v_arla_cents, arla_price),
        appeal_count = COALESCE(appeal_count, 0) + 1,
        approval_level = CASE 
            WHEN (v_first_approver->>'found')::boolean THEN (v_first_approver->>'level')::integer
            ELSE 1
        END,
        current_approver_id = CASE
            WHEN (v_first_approver->>'found')::boolean THEN (v_first_approver->>'user_id')::uuid
            ELSE NULL
        END,
        current_approver_name = CASE
            WHEN (v_first_approver->>'found')::boolean THEN v_first_approver->>'user_name'
            ELSE NULL
        END,
        margin_cents = ((p_new_price - COALESCE(cost_price, 0)) * 100)::integer
    WHERE id = p_request_id;

    -- 6. Notify first approver
    IF (v_first_approver->>'found')::boolean THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            (v_first_approver->>'user_id')::uuid,
            'Recurso de Preço ⚡',
            v_requester_name || ' recorreu ao preço sugerido com um novo valor. Avalie novamente.',
            'appeal_submitted',
            p_request_id,
            false
        );
    END IF;

    RETURN json_build_object('success', true, 'status', 'pending', 'appealCount', COALESCE(v_request.appeal_count, 0) + 1);
END;
$$;


-- ============================================================================
-- 9. ACCEPT SUGGESTED PRICE (requester accepts — new RPC)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.accept_suggested_price(
    p_request_id uuid,
    p_observations text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_requester_name text;
BEGIN
    v_user_id := auth.uid();

    -- 1. Validate
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    IF v_request.status != 'price_suggested' THEN RAISE EXCEPTION 'Request is not in price_suggested status'; END IF;
    IF public._resolve_user_id(v_request.created_by) != v_user_id AND v_request.created_by != v_user_id::text THEN 
        RAISE EXCEPTION 'Only the requester can accept the suggested price'; 
    END IF;

    -- 2. User name
    SELECT nome, email INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    v_requester_name := COALESCE(v_profile.nome, v_profile.email, 'Solicitante');

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, v_requester_name, 'price_accepted',
        v_request.approval_level, p_observations
    );

    -- 4. Update request to approved
    UPDATE public.price_suggestions
    SET status = 'approved',
        approved_by = v_request.last_approver_action_by,
        approved_at = now()
    WHERE id = p_request_id;

    -- 5. Notify the approver who suggested the price
    IF v_request.last_approver_action_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            v_request.last_approver_action_by,
            'Preço Aceito ✅',
            v_requester_name || ' aceitou o preço sugerido.',
            'price_accepted',
            p_request_id,
            false
        );
    END IF;

    RETURN json_build_object('success', true, 'status', 'approved');
END;
$$;
