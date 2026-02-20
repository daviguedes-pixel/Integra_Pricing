-- Migration: Fix request_evidence RPC
-- Corrects the column mismatch (user_id -> approver_id) introduced in a previous migration
-- Ensures compatibilty with approval_history schema
-- DROPS FUNCTION first to allow return type change (jsonb -> json)

DROP FUNCTION IF EXISTS public.request_evidence(uuid, text, text);

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

    -- 1. Validate Not Nulls
    IF p_product IS NULL THEN
        RAISE EXCEPTION 'Product is required';
    END IF;

    IF p_product NOT IN ('principal', 'arla') THEN
        RAISE EXCEPTION 'Product must be "principal" or "arla"';
    END IF;

    -- 2. Fetch Request
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    
    -- ALLOW 'pending' OR 'appealed' (standardizing with other RPCs)
    IF v_request.status NOT IN ('pending', 'appealed') THEN 
        RAISE EXCEPTION 'Request is not pending approval or appealed'; 
    END IF;

    -- 3. Security Check (Must be current approver)
    IF v_request.current_approver_id IS NOT NULL AND v_request.current_approver_id != v_user_id THEN
        RAISE EXCEPTION 'User is not the current approver for this request.';
    END IF;

    -- 4. User Profile & Permissions
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;

    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN
        RAISE EXCEPTION 'User (Role: %) does not have approval permissions', v_profile.perfil;
    END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_current_level := COALESCE(v_request.approval_level, 1);

    -- 5. Audit Trail (CORRECTED COLUMNS)
    INSERT INTO public.approval_history (
        suggestion_id, 
        approver_id, 
        approver_name, 
        action, 
        approval_level, 
        observations
    ) VALUES (
        p_request_id, 
        v_user_id, 
        v_approver_name, 
        'request_evidence',
        v_current_level,
        COALESCE(p_observations, '') || ' | Produto: ' || p_product
    );

    -- 6. Update Request
    UPDATE public.price_suggestions
    SET status = 'awaiting_evidence',
        evidence_product = p_product,
        last_approver_action_by = v_user_id,
        last_observation = p_observations
    WHERE id = p_request_id;

    -- 7. Notify Requester
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
