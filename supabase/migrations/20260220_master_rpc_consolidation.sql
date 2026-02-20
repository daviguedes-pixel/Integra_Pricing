-- Migration: Master RPC Consolidation and Ambiguity Fix
-- This migration drops ALL variations of core approval functions and restores 
-- them with standardized signatures (p_request_id text) and the most advanced logic.

-- ============================================================================
-- 1. EXHAUSTIVE DROP (CLEAR AMBIGUITY)
-- ============================================================================

-- create_price_request
DROP FUNCTION IF EXISTS public.create_price_request(uuid, text, numeric, integer, uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.create_price_request(text, text, numeric, integer, text, text, text, text);
DROP FUNCTION IF EXISTS public.create_price_request(text, text, numeric, integer, text, text, text, text, numeric, numeric, numeric);
DROP FUNCTION IF EXISTS public.create_price_request(text, text, numeric, integer, text, text, text, text, numeric, numeric, numeric, uuid, text, numeric, numeric, numeric, numeric);
DROP FUNCTION IF EXISTS public.create_price_request(text, text, numeric, integer, text, text, text, text, numeric, numeric, numeric, uuid, text, numeric, numeric, numeric, numeric, text);

-- approve_price_request
DROP FUNCTION IF EXISTS public.approve_price_request(uuid);
DROP FUNCTION IF EXISTS public.approve_price_request(uuid, text);
DROP FUNCTION IF EXISTS public.approve_price_request(text, text);

-- reject_price_request
DROP FUNCTION IF EXISTS public.reject_price_request(uuid);
DROP FUNCTION IF EXISTS public.reject_price_request(uuid, text);
DROP FUNCTION IF EXISTS public.reject_price_request(text, text);

-- suggest_price_request
DROP FUNCTION IF EXISTS public.suggest_price_request(uuid, numeric, text);
DROP FUNCTION IF EXISTS public.suggest_price_request(uuid, numeric, text, numeric);
DROP FUNCTION IF EXISTS public.suggest_price_request(text, numeric, text, numeric);

-- request_justification
DROP FUNCTION IF EXISTS public.request_justification(uuid, text);
DROP FUNCTION IF EXISTS public.request_justification(text, text);

-- request_evidence
DROP FUNCTION IF EXISTS public.request_evidence(uuid, text);
DROP FUNCTION IF EXISTS public.request_evidence(uuid, text, text);
DROP FUNCTION IF EXISTS public.request_evidence(text, text, text);

-- provide_justification
DROP FUNCTION IF EXISTS public.provide_justification(uuid, text);
DROP FUNCTION IF EXISTS public.provide_justification(text, text);

-- provide_evidence
DROP FUNCTION IF EXISTS public.provide_evidence(uuid, text);
DROP FUNCTION IF EXISTS public.provide_evidence(uuid, text, text);
DROP FUNCTION IF EXISTS public.provide_evidence(text, text, text);

-- appeal_price_request
DROP FUNCTION IF EXISTS public.appeal_price_request(uuid, numeric, text);
DROP FUNCTION IF EXISTS public.appeal_price_request(uuid, numeric, text, numeric);
DROP FUNCTION IF EXISTS public.appeal_price_request(text, numeric, text, numeric);

-- accept_suggested_price
DROP FUNCTION IF EXISTS public.accept_suggested_price(uuid);
DROP FUNCTION IF EXISTS public.accept_suggested_price(uuid, text);
DROP FUNCTION IF EXISTS public.accept_suggested_price(text, text);

-- ============================================================================
-- 2. CREATE CONSOLIDATED FUNCTIONS
-- ============================================================================

-- (A) CREATE PRICE REQUEST (Including evidence_url and initial approver logic)
CREATE OR REPLACE FUNCTION public.create_price_request(
    p_station_id text,
    p_product text,
    p_final_price numeric,
    p_margin_cents integer DEFAULT 0,
    p_client_id text DEFAULT NULL,
    p_payment_method_id text DEFAULT NULL,
    p_observations text DEFAULT NULL,
    p_status text DEFAULT 'pending',
    p_purchase_cost numeric DEFAULT 0,
    p_freight_cost numeric DEFAULT 0,
    p_cost_price numeric DEFAULT 0,
    p_batch_id uuid DEFAULT NULL,
    p_batch_name text DEFAULT NULL,
    p_volume_made numeric DEFAULT 0,
    p_volume_projected numeric DEFAULT 0,
    p_arla_purchase_price numeric DEFAULT 0,
    p_arla_cost_price numeric DEFAULT 0,
    p_current_price numeric DEFAULT 0,
    p_evidence_url text DEFAULT NULL
)
RETURNS public.price_suggestions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_new_request public.price_suggestions;
    v_cost_data record;
    v_purchase_cost numeric := p_purchase_cost;
    v_freight_cost numeric := p_freight_cost;
    v_total_cost numeric := p_cost_price;
    v_margin_cents integer := p_margin_cents;
    v_initial_profile text;
    v_initial_approver record;
    v_base_nome text := 'Manual';
    v_base_uf text := '';
    v_forma_entrega text := '';
    v_base_bandeira text := '';
    v_base_codigo text := '';
BEGIN
    v_user_id := auth.uid();
    IF p_station_id IS NULL OR p_product IS NULL OR p_final_price IS NULL OR p_final_price <= 0 THEN
        RAISE EXCEPTION 'Missing required fields: station_id, product, or final_price > 0';
    END IF;

    -- Fetch costs if zero
    IF v_purchase_cost = 0 OR v_total_cost = 0 THEN
        BEGIN
            SELECT custo, frete, custo_total, base_nome, base_uf, forma_entrega, base_bandeira, base_codigo
            INTO v_cost_data FROM public.get_lowest_cost_freight(p_station_id, p_product) LIMIT 1;
            IF FOUND THEN
                v_purchase_cost := COALESCE(NULLIF(v_purchase_cost, 0), v_cost_data.custo);
                v_freight_cost := COALESCE(NULLIF(v_freight_cost, 0), v_cost_data.frete);
                v_total_cost := COALESCE(NULLIF(v_total_cost, 0), v_cost_data.custo_total);
                v_base_nome := COALESCE(v_cost_data.base_nome, 'Manual');
                v_base_uf := COALESCE(v_cost_data.base_uf, '');
                v_forma_entrega := COALESCE(v_cost_data.forma_entrega, '');
                v_base_bandeira := COALESCE(v_cost_data.base_bandeira, '');
                v_base_codigo := COALESCE(v_cost_data.base_codigo, '');
            END IF;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
    IF v_total_cost IS NOT NULL AND v_total_cost > 0 THEN
        v_margin_cents := ((p_final_price - v_total_cost) * 100)::integer;
    END IF;

    -- Find Level 1 Approver
    SELECT perfil INTO v_initial_profile FROM public.approval_profile_order WHERE order_position = 1 AND is_active = true LIMIT 1;
    v_initial_profile := COALESCE(v_initial_profile, 'analista_pricing');
    SELECT user_id, nome, email INTO v_initial_approver FROM public.user_profiles WHERE perfil = v_initial_profile AND ativo = true LIMIT 1;

    INSERT INTO public.price_suggestions (
        station_id, product, final_price, current_price, purchase_cost, freight_cost, cost_price, margin_cents, suggested_price,
        client_id, payment_method_id, observations, status, created_by, price_origin_base, price_origin_uf, price_origin_delivery,
        price_origin_bandeira, price_origin_code, batch_id, batch_name, volume_made, volume_projected, arla_purchase_price,
        arla_cost_price, approval_level, approvals_count, total_approvers, current_approver_id, current_approver_name, evidence_url
    ) VALUES (
        p_station_id, p_product::public.product_type, p_final_price, p_current_price, v_purchase_cost, v_freight_cost, v_total_cost,
        v_margin_cents, p_final_price, p_client_id, p_payment_method_id, p_observations, p_status::public.approval_status, v_user_id,
        v_base_nome, v_base_uf, v_forma_entrega, v_base_bandeira, v_base_codigo, p_batch_id, p_batch_name, p_volume_made,
        p_volume_projected, p_arla_purchase_price, p_arla_cost_price, 1, 0, 1, v_initial_approver.user_id,
        COALESCE(v_initial_approver.nome, v_initial_approver.email, 'Perfil: ' || v_initial_profile), p_evidence_url
    ) RETURNING * INTO v_new_request;

    IF v_initial_approver.user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (v_initial_approver.user_id, 'Nova Solicitação', 'Nova solicitação aguardando aprovação (Nível 1)', 'approval_pending', v_new_request.id, false);
    END IF;
    RETURN v_new_request;
END;
$$;

-- (B) APPROVE (With Double Approval Loop Fix)
CREATE OR REPLACE FUNCTION public.approve_price_request(
    p_request_id text,
    p_observations text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid := p_request_id::uuid;
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
    v_user_id := auth.uid();
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    IF v_request.status NOT IN ('pending', 'appealed') THEN RAISE EXCEPTION 'Request is not pending approval or appealed'; END IF;
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;
    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN RAISE EXCEPTION 'Insufficient permissions'; END IF;
    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');

    LOOP
        v_loop_safety := v_loop_safety + 1;
        IF v_loop_safety > 20 THEN RAISE EXCEPTION 'Approval loop limit exceeded'; END IF;
        SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
        v_current_level := COALESCE(v_request.approval_level, 1);
        INSERT INTO public.approval_history (suggestion_id, approver_id, approver_name, action, approval_level, observations)
        VALUES (v_id, v_user_id, v_approver_name, 'approved', v_current_level, p_observations);

        v_can_finalize := public._can_profile_finalize(v_profile.perfil, v_request.margin_cents);
        IF v_can_finalize THEN
            UPDATE public.price_suggestions SET status = 'approved', approved_by = v_user_id, approved_at = now(), 
                current_approver_id = v_user_id, current_approver_name = v_approver_name, approvals_count = COALESCE(approvals_count, 0) + 1,
                last_approver_action_by = v_user_id, last_observation = p_observations WHERE id = v_id;
            RETURN json_build_object('success', true, 'status', 'approved');
        ELSE
            v_next_approver := public._find_next_approver(v_id, v_request.created_by, v_current_level, v_request.margin_cents);
            IF (v_next_approver->>'found')::boolean THEN
                IF (v_next_approver->>'user_id')::uuid = v_user_id THEN
                    UPDATE public.price_suggestions SET approval_level = (v_next_approver->>'level')::integer, approvals_count = COALESCE(approvals_count, 0) + 1 WHERE id = v_id;
                    CONTINUE;
                ELSE
                    UPDATE public.price_suggestions SET approval_level = (v_next_approver->>'level')::integer, current_approver_id = (v_next_approver->>'user_id')::uuid,
                        current_approver_name = v_next_approver->>'user_name', approvals_count = COALESCE(approvals_count, 0) + 1, last_approver_action_by = v_user_id,
                        last_observation = p_observations, status = 'pending' WHERE id = v_id;
                    INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
                    VALUES ((v_next_approver->>'user_id')::uuid, 'Nova Aprovação Pendente', 'Solicitação nível ' || (v_next_approver->>'level'), 'approval_pending', v_id, false);
                    RETURN json_build_object('success', true, 'status', 'pending', 'nextLevel', (v_next_approver->>'level')::integer);
                END IF;
            ELSE
                UPDATE public.price_suggestions SET status = 'approved', approved_by = v_user_id, approved_at = now(), current_approver_id = v_user_id,
                    current_approver_name = v_approver_name, approvals_count = COALESCE(approvals_count, 0) + 1, last_approver_action_by = v_user_id,
                    last_observation = p_observations WHERE id = v_id;
                RETURN json_build_object('success', true, 'status', 'approved');
            END IF;
        END IF;
    END LOOP;
END;
$$;

-- (C) REJECT (With Escalation)
CREATE OR REPLACE FUNCTION public.reject_price_request(
    p_request_id text,
    p_observations text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid := p_request_id::uuid;
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_permissions public.profile_permissions;
    v_approver_name text;
    v_current_level integer;
    v_next_approver json;
BEGIN
    v_user_id := auth.uid();
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    IF v_request.status NOT IN ('pending', 'appealed') THEN RAISE EXCEPTION 'Invalid status'; END IF;
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;
    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN RAISE EXCEPTION 'Insufficient permissions'; END IF;
    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_current_level := COALESCE(v_request.approval_level, 1);

    INSERT INTO public.approval_history (suggestion_id, approver_id, approver_name, action, approval_level, observations)
    VALUES (v_id, v_user_id, v_approver_name, 'rejected', v_current_level, p_observations);

    v_next_approver := public._find_next_approver(v_id, v_request.created_by, v_current_level, v_request.margin_cents);
    IF (v_next_approver->>'found')::boolean THEN
        UPDATE public.price_suggestions SET status = 'pending', approval_level = (v_next_approver->>'level')::integer,
            current_approver_id = (v_next_approver->>'user_id')::uuid, current_approver_name = v_next_approver->>'user_name',
            rejections_count = COALESCE(rejections_count, 0) + 1, last_approver_action_by = v_user_id, rejection_reason = p_observations,
            last_observation = p_observations WHERE id = v_id;
        RETURN json_build_object('success', true, 'status', 'pending', 'action', 'escalated');
    ELSE
        UPDATE public.price_suggestions SET status = 'rejected', approved_by = v_user_id, approved_at = now(), current_approver_id = NULL,
            current_approver_name = NULL, rejections_count = COALESCE(rejections_count, 0) + 1, last_approver_action_by = v_user_id,
            rejection_reason = p_observations, last_observation = p_observations WHERE id = v_id;
        RETURN json_build_object('success', true, 'status', 'rejected', 'action', 'terminated');
    END IF;
END;
$$;

-- (D) SUGGEST PRICE
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
    v_id uuid := p_request_id::uuid;
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_permissions public.profile_permissions;
    v_approver_name text;
    v_current_level integer;
BEGIN
    v_user_id := auth.uid();
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF v_request.status NOT IN ('pending', 'appealed') THEN RAISE EXCEPTION 'Invalid status'; END IF;
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;
    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN RAISE EXCEPTION 'Insufficient permissions'; END IF;
    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_current_level := COALESCE(v_request.approval_level, 1);

    INSERT INTO public.approval_history (suggestion_id, approver_id, approver_name, action, approval_level, observations)
    VALUES (v_id, v_user_id, v_approver_name, 'price_suggested', v_current_level, COALESCE(p_observations, '') || ' | Sugerido: R$ ' || p_suggested_price::text);

    UPDATE public.price_suggestions SET status = 'price_suggested', suggested_price = p_suggested_price, final_price = p_suggested_price,
        arla_price = COALESCE(p_arla_price, arla_price), margin_cents = ((p_suggested_price - COALESCE(cost_price, 0)) * 100)::integer,
        current_approver_id = v_user_id, current_approver_name = v_approver_name, last_approver_action_by = v_user_id, last_observation = p_observations
    WHERE id = v_id;

    IF v_request.created_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (public._resolve_user_id(v_request.created_by), 'Preço Sugerido 💰', v_approver_name || ' sugeriu um novo valor.', 'price_suggested', v_id, false);
    END IF;
    RETURN json_build_object('success', true, 'status', 'price_suggested');
END;
$$;

-- (E) REQUEST JUSTIFICATION
CREATE OR REPLACE FUNCTION public.request_justification(
    p_request_id text,
    p_observations text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid := p_request_id::uuid;
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_permissions public.profile_permissions;
BEGIN
    v_user_id := auth.uid();
    IF p_observations IS NULL OR trim(p_observations) = '' THEN RAISE EXCEPTION 'Observations required'; END IF;
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF v_request.status NOT IN ('pending', 'appealed') THEN RAISE EXCEPTION 'Invalid status'; END IF;
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;
    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN RAISE EXCEPTION 'Insufficient permissions'; END IF;

    INSERT INTO public.approval_history (suggestion_id, approver_id, approver_name, action, approval_level, observations)
    VALUES (v_id, v_user_id, COALESCE(v_profile.nome, v_profile.email, 'Aprovador'), 'request_justification', v_request.approval_level, p_observations);

    UPDATE public.price_suggestions SET status = 'awaiting_justification', last_approver_action_by = v_user_id, last_observation = p_observations WHERE id = v_id;

    IF v_request.created_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (public._resolve_user_id(v_request.created_by), 'Justificativa Solicitada 📝', 'Forneça uma justificativa para sua solicitação.', 'justification_requested', v_id, false);
    END IF;
    RETURN json_build_object('success', true, 'status', 'awaiting_justification');
END;
$$;

-- (F) REQUEST EVIDENCE
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
    v_id uuid := p_request_id::uuid;
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_permissions public.profile_permissions;
BEGIN
    v_user_id := auth.uid();
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF v_request.status NOT IN ('pending', 'appealed') THEN RAISE EXCEPTION 'Invalid status'; END IF;
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;
    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN RAISE EXCEPTION 'Insufficient permissions'; END IF;

    INSERT INTO public.approval_history (suggestion_id, approver_id, approver_name, action, approval_level, observations)
    VALUES (v_id, v_user_id, COALESCE(v_profile.nome, v_profile.email, 'Aprovador'), 'request_evidence', v_request.approval_level, p_observations);

    UPDATE public.price_suggestions SET status = 'awaiting_evidence', last_approver_action_by = v_user_id, last_observation = p_observations WHERE id = v_id;

    IF v_request.created_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (public._resolve_user_id(v_request.created_by), 'Referência Solicitada 📎', 'Forneça uma referência de preço.', 'evidence_requested', v_id, false);
    END IF;
    RETURN json_build_object('success', true, 'status', 'awaiting_evidence', 'evidenceProduct', p_product);
END;
$$;

-- (G) PROVIDE JUSTIFICATION
CREATE OR REPLACE FUNCTION public.provide_justification(
    p_request_id text,
    p_justification text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid := p_request_id::uuid;
    v_user_id uuid;
    v_request public.price_suggestions;
BEGIN
    v_user_id := auth.uid();
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF v_request.status != 'awaiting_justification' THEN RAISE EXCEPTION 'Invalid status'; END IF;
    IF public._resolve_user_id(v_request.created_by) != v_user_id AND v_request.created_by != v_user_id::text THEN RAISE EXCEPTION 'Unauthorized'; END IF;

    INSERT INTO public.approval_history (suggestion_id, approver_id, approver_name, action, approval_level, observations)
    VALUES (v_id, v_user_id, 'Solicitante', 'justification_provided', v_request.approval_level, p_justification);

    UPDATE public.price_suggestions SET status = 'pending', observations = COALESCE(observations, '') || E'\nJustificativa: ' || p_justification WHERE id = v_id;

    IF v_request.last_approver_action_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (v_request.last_approver_action_by, 'Justificativa Fornecida 📝', 'O solicitante enviou a justificativa.', 'justification_provided', v_id, false);
    END IF;
    RETURN json_build_object('success', true, 'status', 'pending');
END;
$$;

-- (H) PROVIDE EVIDENCE
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
    v_id uuid := p_request_id::uuid;
    v_user_id uuid;
    v_request public.price_suggestions;
BEGIN
    v_user_id := auth.uid();
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF v_request.status != 'awaiting_evidence' THEN RAISE EXCEPTION 'Invalid status'; END IF;
    IF public._resolve_user_id(v_request.created_by) != v_user_id AND v_request.created_by != v_user_id::text THEN RAISE EXCEPTION 'Unauthorized'; END IF;

    INSERT INTO public.approval_history (suggestion_id, approver_id, approver_name, action, approval_level, observations, attachment_url)
    VALUES (v_id, v_user_id, 'Solicitante', 'evidence_provided', v_request.approval_level, p_observations, p_attachment_url);

    UPDATE public.price_suggestions SET status = 'pending', evidence_url = p_attachment_url WHERE id = v_id;

    IF v_request.last_approver_action_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (v_request.last_approver_action_by, 'Referência Fornecida 📎', 'O solicitante enviou a referência pedida.', 'evidence_provided', v_id, false);
    END IF;
    RETURN json_build_object('success', true, 'status', 'pending');
END;
$$;

-- (I) APPEAL (With Locking)
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
    v_id uuid := p_request_id::uuid;
    v_user_id uuid;
    v_request public.price_suggestions;
BEGIN
    v_user_id := auth.uid();
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    IF v_request.status != 'price_suggested' THEN RAISE EXCEPTION 'Already processed (Status: %)', v_request.status; END IF;

    INSERT INTO public.approval_history (suggestion_id, approver_id, approver_name, action, approval_level, observations)
    VALUES (v_id, v_user_id, 'Solicitante (Recurso)', 'appealed', v_request.approval_level, COALESCE(p_observations, '') || ' | Contraproposta: R$ ' || p_new_price::text);

    UPDATE public.price_suggestions SET status = 'appealed', suggested_price = p_new_price, final_price = p_new_price, 
        arla_price = COALESCE(p_arla_price, arla_price), margin_cents = ((p_new_price - COALESCE(cost_price, 0)) * 100)::integer,
        last_observation = p_observations WHERE id = v_id;

    IF v_request.current_approver_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (v_request.current_approver_id, 'Recurso de Preço ↩️', 'O solicitante enviou uma contraproposta.', 'appealed', v_id, false);
    END IF;
    RETURN json_build_object('success', true, 'status', 'appealed', 'newPrice', p_new_price);
END;
$$;

-- (J) ACCEPT SUGGESTED PRICE
CREATE OR REPLACE FUNCTION public.accept_suggested_price(
    p_request_id text,
    p_observations text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid := p_request_id::uuid;
    v_user_id uuid;
    v_request public.price_suggestions;
BEGIN
    v_user_id := auth.uid();
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF v_request.status != 'price_suggested' THEN RAISE EXCEPTION 'Invalid status'; END IF;
    IF public._resolve_user_id(v_request.created_by) != v_user_id AND v_request.created_by != v_user_id::text THEN RAISE EXCEPTION 'Unauthorized'; END IF;

    INSERT INTO public.approval_history (suggestion_id, approver_id, approver_name, action, approval_level, observations)
    VALUES (v_id, v_user_id, 'Solicitante', 'accepted_suggestion', v_request.approval_level, p_observations);

    UPDATE public.price_suggestions SET status = 'approved', approved_by = v_request.last_approver_action_by, approved_at = now() WHERE id = v_id;

    IF v_request.last_approver_action_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (v_request.last_approver_action_by, 'Preço Aceito ✅', 'O solicitante aceitou o preço sugerido.', 'price_accepted', v_id, false);
    END IF;
    RETURN json_build_object('success', true, 'status', 'approved');
END;
$$;
