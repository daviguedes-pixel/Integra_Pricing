-- Migration: Fix Approval Hierarchy and Evidence RPC Ambiguity
-- 1. Drops ambiguous variations to prevent "choose best candidate" errors
-- 2. Restores hierarchical flow in _find_next_approver (removes strict required_profiles skipping)
-- 3. Fixes permission lookup in approve_price_request
-- 4. Standardizes provide_evidence to use text ID
-- 5. Robust UUID casting to prevent crashes on invalid input in ALL approval RPCs

-- ============================================================================
-- 1. CLEANUP (DROPS) - Dynamic to clear all overloads
-- ============================================================================
DO $$
DECLARE
    func_name text;
    func_sig text;
BEGIN
    FOR func_name IN SELECT unnest(ARRAY[
        'approve_price_request', 'reject_price_request', 'suggest_price_request',
        'request_evidence', 'provide_evidence', 'request_justification',
        'provide_justification', 'appeal_price_request', 'accept_suggested_price'
    ]) LOOP
        FOR func_sig IN (
            SELECT oid::regprocedure::text
            FROM pg_proc 
            WHERE proname = func_name 
              AND pronamespace = 'public'::regnamespace
        ) LOOP
            EXECUTE 'DROP FUNCTION ' || func_sig;
        END LOOP;
    END LOOP;
END $$;

-- ============================================================================
-- 2. UPDATED _FIND_NEXT_APPROVER
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
    v_next_level integer;
    v_next_profile text;
    v_next_user record;
    v_already_acted_profiles text[];
    v_creator_uuid uuid;
BEGIN
    v_creator_uuid := public._resolve_user_id(p_created_by);

    -- Load active approval order
    SELECT array_agg(perfil ORDER BY order_position ASC) INTO v_approval_order
    FROM public.approval_profile_order WHERE is_active = true;

    IF v_approval_order IS NULL OR array_length(v_approval_order, 1) = 0 THEN
        v_approval_order := ARRAY['analista_pricing', 'supervisor_comercial', 'diretor_comercial', 'diretor_pricing'];
    END IF;

    -- Get profiles that already acted on this request to avoid loops
    SELECT COALESCE(array_agg(DISTINCT up.perfil), ARRAY[]::text[])
    INTO v_already_acted_profiles
    FROM public.approval_history ah
    JOIN public.user_profiles up ON up.user_id = ah.approver_id
    WHERE ah.suggestion_id = p_request_id
      AND ah.action IN ('approved', 'rejected');

    -- WALK THE HIERARCHY sequentially
    FOR i IN (p_current_level + 1)..array_length(v_approval_order, 1) LOOP
        v_next_profile := v_approval_order[i];

        -- Skip profiles that already acted
        IF v_next_profile = ANY(v_already_acted_profiles) THEN
            CONTINUE;
        END IF;

        -- Find a user for this profile, skipping the request creator
        SELECT user_id, email, nome INTO v_next_user
        FROM public.user_profiles
        WHERE perfil = v_next_profile AND ativo = true 
          AND user_id != COALESCE(v_creator_uuid, '00000000-0000-0000-0000-000000000000'::uuid)
          AND email != COALESCE(p_created_by, '')
          AND nome != COALESCE(p_created_by, '')
        LIMIT 1;

        -- Fallback if no specific user found
        IF v_next_user.user_id IS NULL THEN
            SELECT user_id, email, nome INTO v_next_user
            FROM public.user_profiles
            WHERE perfil = v_next_profile AND ativo = true
            LIMIT 1;

            IF v_next_user.user_id = v_creator_uuid OR v_next_user.email = p_created_by OR v_next_user.nome = p_created_by THEN
                v_next_user := NULL;
                CONTINUE;
            END IF;
        END IF;

        IF v_next_user.user_id IS NOT NULL THEN
            RETURN json_build_object(
                'found', true,
                'level', i,
                'profile', v_next_profile,
                'user_id', v_next_user.user_id,
                'user_name', COALESCE(v_next_user.nome, v_next_user.email, 'Perfil: ' || v_next_profile)
            );
        END IF;
    END LOOP;

    RETURN json_build_object('found', false);
END;
$$;

-- ============================================================================
-- 3. APPROVE_PRICE_REQUEST
-- ============================================================================
CREATE OR REPLACE FUNCTION public.approve_price_request(
    p_request_id text,
    p_observations text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid;
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_permissions public.profile_permissions;
    v_approver_name text;
    v_current_level integer;
    v_can_finalize boolean;
    v_next_approver json;
    v_loop_safety integer := 0;
BEGIN
    BEGIN
        v_id := p_request_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', 'ID de solicitação inválido: ' || p_request_id || '. Esperado UUID.');
    END;

    v_user_id := auth.uid();
    
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada: %', p_request_id; END IF;
    IF v_request.status NOT IN ('pending', 'appealed') THEN 
        RAISE EXCEPTION 'Solicitação não está pendente ou em recurso (Status atual: %)', v_request.status; 
    END IF;

    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;
    
    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN 
        RAISE EXCEPTION 'Perfil % não tem permissão de aprovação.', v_profile.perfil; 
    END IF;
    
    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');

    LOOP
        v_loop_safety := v_loop_safety + 1;
        IF v_loop_safety > 10 THEN RAISE EXCEPTION 'Limite de loop de aprovação atingido'; END IF;

        SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
        v_current_level := COALESCE(v_request.approval_level, 1);

        -- Audit Log
        INSERT INTO public.approval_history (suggestion_id, approver_id, approver_name, action, approval_level, observations)
        VALUES (v_id, v_user_id, v_approver_name, 'approved', v_current_level, p_observations);

        -- Check Final Authority
        v_can_finalize := public._can_profile_finalize(v_profile.perfil, v_request.margin_cents);

        IF v_can_finalize THEN
            UPDATE public.price_suggestions 
            SET status = 'approved', approved_by = v_user_id, approved_at = now(), 
                current_approver_id = v_user_id, current_approver_name = v_approver_name, 
                approvals_count = COALESCE(approvals_count, 0) + 1,
                last_approver_action_by = v_user_id, last_observation = p_observations 
            WHERE id = v_id;

            -- Notify Requester
            IF v_request.created_by IS NOT NULL THEN
                INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
                VALUES (public._resolve_user_id(v_request.created_by::text), 'Solicitação Aprovada ✅', 'Sua solicitação foi aprovada por ' || v_approver_name, 'request_approved', v_id, false);
            END IF;

            RETURN json_build_object('success', true, 'status', 'approved');
        ELSE
            -- ESCALATE
            v_next_approver := public._find_next_approver(v_id, v_request.created_by::text, v_current_level, v_request.margin_cents);
            
            IF (v_next_approver->>'found')::boolean THEN
                IF (v_next_approver->>'user_id')::uuid = v_user_id THEN
                    UPDATE public.price_suggestions SET approval_level = (v_next_approver->>'level')::integer WHERE id = v_id;
                    CONTINUE;
                ELSE
                    UPDATE public.price_suggestions 
                    SET approval_level = (v_next_approver->>'level')::integer, 
                        current_approver_id = (v_next_approver->>'user_id')::uuid,
                        current_approver_name = v_next_approver->>'user_name', 
                        approvals_count = COALESCE(approvals_count, 0) + 1, 
                        last_approver_action_by = v_user_id,
                        last_observation = p_observations 
                    WHERE id = v_id;

                    INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
                    VALUES ((v_next_approver->>'user_id')::uuid, 'Aprovação Pendente', 'Solicitação escalada para seu nível.', 'approval_pending', v_id, false);
                    
                    RETURN json_build_object('success', true, 'status', 'pending', 'nextLevel', (v_next_approver->>'level')::integer);
                END IF;
            ELSE
                UPDATE public.price_suggestions SET status = 'approved', approved_by = v_user_id, approved_at = now() WHERE id = v_id;
                RETURN json_build_object('success', true, 'status', 'approved', 'warn', 'no_further_approvers');
            END IF;
        END IF;
    END LOOP;
END;
$$;

-- ============================================================================
-- 4. REJECT_PRICE_REQUEST
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reject_price_request(
    p_request_id text,
    p_observations text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid;
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_permissions public.profile_permissions;
    v_approver_name text;
    v_current_level integer;
    v_next_approver json;
BEGIN
    BEGIN
        v_id := p_request_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', 'ID de solicitação inválido: ' || p_request_id || '. Esperado UUID.');
    END;

    v_user_id := auth.uid();

    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
    IF v_request.status NOT IN ('pending', 'appealed') THEN RAISE EXCEPTION 'Estado inválido'; END IF;

    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;

    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN RAISE EXCEPTION 'Sem permissão'; END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_current_level := COALESCE(v_request.approval_level, 1);

    -- Audit Log
    INSERT INTO public.approval_history (suggestion_id, approver_id, approver_name, action, approval_level, observations)
    VALUES (v_id, v_user_id, v_approver_name, 'rejected', v_current_level, p_observations);

    -- Try escalate or terminate
    v_next_approver := public._find_next_approver(v_id, v_request.created_by::text, v_current_level, v_request.margin_cents);

    IF (v_next_approver->>'found')::boolean THEN
        UPDATE public.price_suggestions
        SET status = 'pending', approval_level = (v_next_approver->>'level')::integer,
            current_approver_id = (v_next_approver->>'user_id')::uuid,
            current_approver_name = v_next_approver->>'user_name',
            rejections_count = COALESCE(rejections_count, 0) + 1,
            last_approver_action_by = v_user_id,
            rejection_reason = p_observations, last_observation = p_observations
        WHERE id = v_id;

        RETURN json_build_object('success', true, 'status', 'pending', 'action', 'escalated');
    ELSE
        UPDATE public.price_suggestions
        SET status = 'rejected', approved_by = v_user_id, approved_at = now(),
            current_approver_id = NULL, current_approver_name = NULL,
            rejections_count = COALESCE(rejections_count, 0) + 1,
            last_approver_action_by = v_user_id,
            rejection_reason = p_observations, last_observation = p_observations
        WHERE id = v_id;

        IF v_request.created_by IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
            VALUES (public._resolve_user_id(v_request.created_by::text), 'Solicitação Rejeitada ❌', 'Sua solicitação foi rejeitada por ' || v_approver_name, 'price_rejected', v_id, false);
        END IF;

        RETURN json_build_object('success', true, 'status', 'rejected', 'action', 'terminated');
    END IF;
END;
$$;

-- ============================================================================
-- 5. SUGGEST_PRICE_REQUEST
-- ============================================================================
CREATE OR REPLACE FUNCTION public.suggest_price_request(
    p_request_id text,
    p_suggested_price numeric,
    p_observations text DEFAULT NULL,
    p_arla_price numeric DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid;
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_permissions public.profile_permissions;
    v_approver_name text;
    v_new_margin_cents integer;
BEGIN
    BEGIN
        v_id := p_request_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', 'ID de solicitação inválido: ' || p_request_id || '. Esperado UUID.');
    END;

    v_user_id := auth.uid();
    IF p_suggested_price IS NULL OR p_suggested_price <= 0 THEN RAISE EXCEPTION 'Preço inválido'; END IF;

    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Não encontrada'; END IF;
    IF v_request.status NOT IN ('pending', 'appealed') THEN RAISE EXCEPTION 'Estado inválido'; END IF;

    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;

    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN RAISE EXCEPTION 'Sem permissão'; END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_new_margin_cents := ((p_suggested_price - COALESCE(v_request.cost_price, 0)) * 100)::integer;

    INSERT INTO public.approval_history (suggestion_id, approver_id, approver_name, action, approval_level, observations)
    VALUES (v_id, v_user_id, v_approver_name, 'price_suggested', v_request.approval_level,
            COALESCE(p_observations, '') || ' | Preço sugerido: R$ ' || p_suggested_price::text);

    UPDATE public.price_suggestions
    SET status = 'price_suggested', suggested_price = p_suggested_price,
        final_price = p_suggested_price, arla_price = COALESCE(p_arla_price, arla_price),
        margin_cents = v_new_margin_cents, current_approver_id = v_user_id,
        current_approver_name = v_approver_name, last_approver_action_by = v_user_id,
        last_observation = p_observations
    WHERE id = v_id;

    IF v_request.created_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (public._resolve_user_id(v_request.created_by::text), 'Preço Sugerido 💰', v_approver_name || ' sugeriu um novo preço.', 'price_suggested', v_id, false);
    END IF;

    RETURN json_build_object('success', true, 'status', 'price_suggested');
END;
$$;

-- ============================================================================
-- 6. REQUEST_EVIDENCE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.request_evidence(
    p_request_id text,
    p_product text,
    p_observations text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid;
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_permissions public.profile_permissions;
    v_approver_name text;
BEGIN
    BEGIN
        v_id := p_request_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', 'ID de solicitação inválido: ' || p_request_id || '. Esperado UUID.');
    END;

    v_user_id := auth.uid();
    IF p_product NOT IN ('principal', 'arla') THEN RAISE EXCEPTION 'Produto inválido'; END IF;

    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Não encontrada'; END IF;
    IF v_request.status NOT IN ('pending', 'appealed') THEN RAISE EXCEPTION 'Estado inválido'; END IF;

    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;

    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN RAISE EXCEPTION 'Sem permissão'; END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');

    INSERT INTO public.approval_history (suggestion_id, approver_id, approver_name, action, approval_level, observations)
    VALUES (v_id, v_user_id, v_approver_name, 'request_evidence', v_request.approval_level,
            COALESCE(p_observations, '') || ' | Produto: ' || p_product);

    UPDATE public.price_suggestions
    SET status = 'awaiting_evidence', evidence_product = p_product,
        last_approver_action_by = v_user_id, last_observation = p_observations
    WHERE id = v_id;

    IF v_request.created_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (public._resolve_user_id(v_request.created_by::text), 'Referência Solicitada 📎', v_approver_name || ' solicitou referência.', 'evidence_requested', v_id, false);
    END IF;

    RETURN json_build_object('success', true, 'status', 'awaiting_evidence');
END;
$$;

-- ============================================================================
-- 7. PROVIDE_EVIDENCE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.provide_evidence(
    p_request_id text,
    p_attachment_url text,
    p_observations text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid;
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_requester_name text;
    v_current_attachments text[];
BEGIN
    BEGIN
        v_id := p_request_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', 'ID de solicitação inválido: ' || p_request_id || '. Esperado UUID.');
    END;

    v_user_id := auth.uid();
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Não encontrada'; END IF;
    IF v_request.status != 'awaiting_evidence' THEN RAISE EXCEPTION 'Estado inválido'; END IF;

    IF public._resolve_user_id(v_request.created_by::text) != v_user_id AND v_request.created_by::text != v_user_id::text THEN RAISE EXCEPTION 'Não autorizado'; END IF;

    SELECT nome, email INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    v_requester_name := COALESCE(v_profile.nome, v_profile.email, 'Solicitante');

    v_current_attachments := COALESCE(v_request.attachments, ARRAY[]::text[]);
    IF p_attachment_url IS NOT NULL AND p_attachment_url != '' THEN
        v_current_attachments := array_append(v_current_attachments, p_attachment_url);
    END IF;

    INSERT INTO public.approval_history (suggestion_id, approver_id, approver_name, action, approval_level, observations, attachment_url)
    VALUES (v_id, v_user_id, v_requester_name, 'evidence_provided', v_request.approval_level, COALESCE(p_observations, 'Enviada.'), p_attachment_url);

    UPDATE public.price_suggestions
    SET status = 'pending', evidence_url = COALESCE(p_attachment_url, evidence_url),
        attachments = v_current_attachments, evidence_product = NULL
    WHERE id = v_id;

    IF v_request.last_approver_action_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (v_request.last_approver_action_by, 'Referência Fornecida 📎', v_requester_name || ' enviou referência.', 'evidence_provided', v_id, false);
    END IF;

    RETURN json_build_object('success', true, 'status', 'pending');
END;
$$;

-- ============================================================================
-- 8. REQUEST_JUSTIFICATION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.request_justification(
    p_request_id text,
    p_observations text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid;
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_permissions public.profile_permissions;
    v_approver_name text;
BEGIN
    BEGIN
        v_id := p_request_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', 'ID de solicitação inválido: ' || p_request_id || '. Esperado UUID.');
    END;

    v_user_id := auth.uid();
    IF p_observations IS NULL OR trim(p_observations) = '' THEN RAISE EXCEPTION 'Observações obrigatórias'; END IF;

    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Não encontrada'; END IF;
    IF v_request.status NOT IN ('pending', 'appealed') THEN RAISE EXCEPTION 'Estado inválido'; END IF;

    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;

    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN RAISE EXCEPTION 'Sem permissão'; END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');

    INSERT INTO public.approval_history (suggestion_id, approver_id, approver_name, action, approval_level, observations)
    VALUES (v_id, v_user_id, v_approver_name, 'request_justification', v_request.approval_level, p_observations);

    UPDATE public.price_suggestions
    SET status = 'awaiting_justification', last_approver_action_by = v_user_id, last_observation = p_observations
    WHERE id = v_id;

    IF v_request.created_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (public._resolve_user_id(v_request.created_by::text), 'Justificativa Solicitada 📝', v_approver_name || ' solicitou justificativa.', 'justification_requested', v_id, false);
    END IF;

    RETURN json_build_object('success', true, 'status', 'awaiting_justification');
END;
$$;

-- ============================================================================
-- 9. PROVIDE_JUSTIFICATION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.provide_justification(
    p_request_id text,
    p_justification text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid;
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_requester_name text;
BEGIN
    BEGIN
        v_id := p_request_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', 'ID de solicitação inválido: ' || p_request_id || '. Esperado UUID.');
    END;

    v_user_id := auth.uid();
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Não encontrada'; END IF;
    IF v_request.status != 'awaiting_justification' THEN RAISE EXCEPTION 'Estado inválido'; END IF;

    IF public._resolve_user_id(v_request.created_by::text) != v_user_id AND v_request.created_by::text != v_user_id::text THEN RAISE EXCEPTION 'Não autorizado'; END IF;

    SELECT nome, email INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    v_requester_name := COALESCE(v_profile.nome, v_profile.email, 'Solicitante');

    INSERT INTO public.approval_history (suggestion_id, approver_id, approver_name, action, approval_level, observations)
    VALUES (v_id, v_user_id, v_requester_name, 'justification_provided', v_request.approval_level, p_justification);

    UPDATE public.price_suggestions
    SET status = 'pending', last_observation = p_justification
    WHERE id = v_id;

    IF v_request.last_approver_action_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (v_request.last_approver_action_by, 'Justificativa Enviada 💬', v_requester_name || ' enviou justificativa.', 'justification_provided', v_id, false);
    END IF;

    RETURN json_build_object('success', true, 'status', 'pending');
END;
$$;

-- ============================================================================
-- 10. APPEAL_PRICE_REQUEST
-- ============================================================================
CREATE OR REPLACE FUNCTION public.appeal_price_request(
    p_request_id text,
    p_new_price numeric,
    p_observations text DEFAULT NULL,
    p_arla_price numeric DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid;
    v_user_id uuid;
    v_request public.price_suggestions;
BEGIN
    BEGIN
        v_id := p_request_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', 'ID de solicitação inválido: ' || p_request_id || '. Esperado UUID.');
    END;

    v_user_id := auth.uid();
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Não encontrada'; END IF;
    IF v_request.status NOT IN ('price_suggested') THEN RAISE EXCEPTION 'Não está em modo sugestão'; END IF;

    INSERT INTO public.approval_history (suggestion_id, approver_id, approver_name, action, approval_level, observations)
    VALUES (v_id, v_user_id, 'Solicitante (Recurso)', 'appealed', v_request.approval_level,
            COALESCE(p_observations, '') || ' | Contraproposta: R$ ' || p_new_price::text);

    UPDATE public.price_suggestions
    SET status = 'appealed', suggested_price = p_new_price,
        arla_price = COALESCE(p_arla_price, arla_price), last_observation = p_observations
    WHERE id = v_id;

    IF v_request.current_approver_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (v_request.current_approver_id, 'Recurso de Preço ↩️', 'O solicitante enviou contraproposta.', 'appealed', v_id, false);
    END IF;

    RETURN json_build_object('success', true, 'status', 'appealed');
END;
$$;

-- ============================================================================
-- 11. ACCEPT_SUGGESTED_PRICE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.accept_suggested_price(
    p_request_id text,
    p_observations text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid;
    v_user_id uuid;
    v_request public.price_suggestions;
BEGIN
    BEGIN
        v_id := p_request_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', 'ID de solicitação inválido: ' || p_request_id || '. Esperado UUID.');
    END;

    v_user_id := auth.uid();
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Não encontrada'; END IF;
    IF v_request.status NOT IN ('price_suggested') THEN RAISE EXCEPTION 'Não está em modo sugestão'; END IF;

    INSERT INTO public.approval_history (suggestion_id, approver_id, approver_name, action, approval_level, observations)
    VALUES (v_id, v_user_id, 'Solicitante', 'accepted_suggestion', v_request.approval_level, COALESCE(p_observations, 'Aceito o preço sugerido.'));

    UPDATE public.price_suggestions
    SET status = 'approved', approved_by = v_request.current_approver_id, approved_at = now(),
        last_approver_action_by = v_user_id, last_observation = p_observations
    WHERE id = v_id;

    IF v_request.current_approver_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (v_request.current_approver_id, 'Sugestão Aceita ✅', 'O solicitante aceitou o preço.', 'suggestion_accepted', v_id, false);
    END IF;

    RETURN json_build_object('success', true, 'status', 'approved');
END;
$$;
