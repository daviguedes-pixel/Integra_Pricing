-- Migration: Fix permission checks in approval RPCs
-- 1. Grant approval permissions to roles (profiles)
-- 2. Update RPCs to check permissions by PROFILE, not user_id

-- 1. Update permissions for roles
UPDATE public.profile_permissions
SET can_approve = true,
    updated_at = now()
WHERE perfil IN ('analista_pricing', 'supervisor_comercial', 'diretor_comercial', 'diretor_pricing', 'admin', 'gerente');

-- 2. Update RPCs

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
    
    -- FIX: Look up permissions by PROFILE, not user_id
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;

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
                v_request.created_by,
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
                    v_request.created_by,
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
    
    -- FIX: Look up permissions by PROFILE, not user_id
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;

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
            v_request.created_by,
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

    -- FIX: Look up permissions by PROFILE, not user_id
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;

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
            v_request.created_by,
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

    -- FIX: Look up permissions by PROFILE, not user_id
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;

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
            v_request.created_by,
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
