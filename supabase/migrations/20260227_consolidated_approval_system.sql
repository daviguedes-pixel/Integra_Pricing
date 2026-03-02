-- ==========================================================================================
-- MIGRATION CONSOLIDADA DEFINITIVA v3: Sistema de Aprovações (ERP)
-- Data: 2026-03-02
-- ==========================================================================================
-- FIX v3: TODAS comparações user_id usam ::text (user_profiles.user_id é TEXT)
-- FIX v2: Todas RPCs usam TEXT para p_request_id (PostgREST compatível)
-- FIX v2: get_approval_margin_rule usa RETURNS TABLE
-- FIX v2: Inclui regras de margem padrão + NOTIFY pgrst
-- ==========================================================================================

-- ============================================================================
-- PASSO 0: GARANTIR COLUNAS NECESSÁRIAS (idempotente)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_suggestions' AND column_name = 'arla_price') THEN
        ALTER TABLE public.price_suggestions ADD COLUMN arla_price NUMERIC(10,4);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_suggestions' AND column_name = 'final_price') THEN
        ALTER TABLE public.price_suggestions ADD COLUMN final_price NUMERIC(10,4);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_suggestions' AND column_name = 'last_observation') THEN
        ALTER TABLE public.price_suggestions ADD COLUMN last_observation TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_suggestions' AND column_name = 'evidence_url') THEN
        ALTER TABLE public.price_suggestions ADD COLUMN evidence_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_suggestions' AND column_name = 'evidence_product') THEN
        ALTER TABLE public.price_suggestions ADD COLUMN evidence_product TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_suggestions' AND column_name = 'attachments') THEN
        ALTER TABLE public.price_suggestions ADD COLUMN attachments TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_suggestions' AND column_name = 'last_approver_action_by') THEN
        ALTER TABLE public.price_suggestions ADD COLUMN last_approver_action_by UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_suggestions' AND column_name = 'suggested_price') THEN
        ALTER TABLE public.price_suggestions ADD COLUMN suggested_price NUMERIC(10,4);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profile_permissions' AND column_name = 'requires_evidence') THEN
        ALTER TABLE public.profile_permissions ADD COLUMN requires_evidence BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profile_permissions' AND column_name = 'max_discount_with_evidence_cents') THEN
        ALTER TABLE public.profile_permissions ADD COLUMN max_discount_with_evidence_cents INTEGER DEFAULT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'approval_history' AND column_name = 'attachment_url') THEN
        ALTER TABLE public.approval_history ADD COLUMN attachment_url TEXT;
    END IF;
END $$;

-- ============================================================================
-- PASSO 1: DROP EXAUSTIVO DE TODAS AS ASSINATURAS CONHECIDAS
-- ============================================================================

-- _resolve_user_id
DROP FUNCTION IF EXISTS public._resolve_user_id(text);
DROP FUNCTION IF EXISTS public._resolve_user_id(uuid);

-- _find_next_approver (TODAS variantes)
DROP FUNCTION IF EXISTS public._find_next_approver(uuid, text, integer, integer);
DROP FUNCTION IF EXISTS public._find_next_approver(uuid, uuid, integer, integer);

-- _can_profile_finalize
DROP FUNCTION IF EXISTS public._can_profile_finalize(text, integer);
DROP FUNCTION IF EXISTS public._can_profile_finalize(text, uuid);

-- get_approval_margin_rule (TODAS variantes)
DROP FUNCTION IF EXISTS public.get_approval_margin_rule(integer);

-- create_price_request (TODAS assinaturas)
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT p.oid, pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'create_price_request'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.create_price_request(' || r.args || ')';
    END LOOP;
END $$;

-- approve_price_request
DROP FUNCTION IF EXISTS public.approve_price_request(uuid);
DROP FUNCTION IF EXISTS public.approve_price_request(uuid, text);
DROP FUNCTION IF EXISTS public.approve_price_request(text, text);
DROP FUNCTION IF EXISTS public.approve_price_request(text);

-- reject_price_request
DROP FUNCTION IF EXISTS public.reject_price_request(uuid);
DROP FUNCTION IF EXISTS public.reject_price_request(uuid, text);
DROP FUNCTION IF EXISTS public.reject_price_request(text, text);
DROP FUNCTION IF EXISTS public.reject_price_request(text);

-- suggest_price_request
DROP FUNCTION IF EXISTS public.suggest_price_request(uuid, numeric, text);
DROP FUNCTION IF EXISTS public.suggest_price_request(uuid, numeric, text, numeric);
DROP FUNCTION IF EXISTS public.suggest_price_request(text, numeric, text, numeric);
DROP FUNCTION IF EXISTS public.suggest_price_request(text, numeric, text);

-- request_justification
DROP FUNCTION IF EXISTS public.request_justification(uuid, text);
DROP FUNCTION IF EXISTS public.request_justification(text, text);

-- request_evidence
DROP FUNCTION IF EXISTS public.request_evidence(uuid, text);
DROP FUNCTION IF EXISTS public.request_evidence(uuid, text, text);
DROP FUNCTION IF EXISTS public.request_evidence(text, text, text);
DROP FUNCTION IF EXISTS public.request_evidence(text, text);

-- provide_justification
DROP FUNCTION IF EXISTS public.provide_justification(uuid, text);
DROP FUNCTION IF EXISTS public.provide_justification(text, text);

-- provide_evidence
DROP FUNCTION IF EXISTS public.provide_evidence(uuid, text);
DROP FUNCTION IF EXISTS public.provide_evidence(uuid, text, text);
DROP FUNCTION IF EXISTS public.provide_evidence(text, text, text);
DROP FUNCTION IF EXISTS public.provide_evidence(text, text);

-- appeal_price_request
DROP FUNCTION IF EXISTS public.appeal_price_request(uuid, numeric, text);
DROP FUNCTION IF EXISTS public.appeal_price_request(uuid, numeric, text, numeric);
DROP FUNCTION IF EXISTS public.appeal_price_request(text, numeric, text, numeric);
DROP FUNCTION IF EXISTS public.appeal_price_request(text, numeric, text);

-- accept_suggested_price
DROP FUNCTION IF EXISTS public.accept_suggested_price(uuid);
DROP FUNCTION IF EXISTS public.accept_suggested_price(uuid, text);
DROP FUNCTION IF EXISTS public.accept_suggested_price(text, text);
DROP FUNCTION IF EXISTS public.accept_suggested_price(text);


-- ============================================================================
-- PASSO 2: FIX CONSTRAINTS
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_history_action_check') THEN
        ALTER TABLE public.approval_history DROP CONSTRAINT approval_history_action_check;
    END IF;
    ALTER TABLE public.approval_history
    ADD CONSTRAINT approval_history_action_check
    CHECK (action IN ('approved', 'rejected', 'price_suggested', 'request_justification',
                      'request_evidence', 'appealed', 'justification_provided',
                      'evidence_provided', 'accepted_suggestion'));
END $$;


-- ============================================================================
-- PASSO 3: PERMISSÕES E ORDEM DE APROVAÇÃO
-- ============================================================================
DO $$
DECLARE r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['analista_pricing', 'supervisor_comercial', 'diretor_comercial', 'diretor_pricing', 'admin', 'gerente']
    LOOP
        INSERT INTO public.profile_permissions (perfil, can_approve, created_at, updated_at)
        VALUES (r, true, now(), now())
        ON CONFLICT (perfil) DO UPDATE SET can_approve = true, updated_at = now();
    END LOOP;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.approval_profile_order WHERE perfil = 'supervisor_comercial' AND is_active = true) THEN
        INSERT INTO public.approval_profile_order (order_position, perfil, is_active)
        VALUES (1, 'supervisor_comercial', true)
        ON CONFLICT DO NOTHING;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.approval_profile_order WHERE perfil = 'diretor_comercial' AND is_active = true) THEN
        INSERT INTO public.approval_profile_order (order_position, perfil, is_active)
        VALUES (2, 'diretor_comercial', true)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;


-- ============================================================================
-- PASSO 4: FUNÇÕES HELPER
-- ============================================================================

-- (A) _resolve_user_id(text) -> uuid
CREATE OR REPLACE FUNCTION public._resolve_user_id(p_identifier text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    IF p_identifier IS NULL OR trim(p_identifier) = '' THEN
        RETURN NULL;
    END IF;
    -- Tentar como UUID direto
    IF p_identifier ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
        RETURN p_identifier::uuid;
    END IF;
    -- Fallback: buscar por email ou nome
    SELECT user_id INTO v_user_id
    FROM public.user_profiles
    WHERE email = p_identifier OR nome = p_identifier
    LIMIT 1;
    RETURN v_user_id;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Overload UUID -> UUID
CREATE OR REPLACE FUNCTION public._resolve_user_id(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN p_id;
END;
$$;


-- (B) get_approval_margin_rule — RETURNS TABLE (assinatura original)
CREATE OR REPLACE FUNCTION public.get_approval_margin_rule(margin_cents INTEGER)
RETURNS TABLE (
    id UUID,
    min_margin_cents INTEGER,
    max_margin_cents INTEGER,
    required_profiles TEXT[],
    rule_name TEXT,
    priority_order INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.min_margin_cents,
        r.max_margin_cents,
        r.required_profiles,
        r.rule_name,
        r.priority_order
    FROM public.approval_margin_rules r
    WHERE r.is_active = true
        AND r.min_margin_cents <= margin_cents
        AND (r.max_margin_cents IS NULL OR r.max_margin_cents >= margin_cents)
    ORDER BY r.priority_order DESC, r.min_margin_cents DESC
    LIMIT 1;
END;
$$;


-- (C) _find_next_approver
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
    v_next_profile text;
    v_next_user record;
    v_already_acted_profiles text[];
    v_creator_uuid uuid;
    v_i integer;
BEGIN
    v_creator_uuid := public._resolve_user_id(p_created_by);

    SELECT array_agg(perfil ORDER BY order_position ASC) INTO v_approval_order
    FROM public.approval_profile_order WHERE is_active = true;

    IF v_approval_order IS NULL OR array_length(v_approval_order, 1) = 0 THEN
        v_approval_order := ARRAY['supervisor_comercial', 'diretor_comercial'];
    END IF;

    -- Buscar regra de margem
    SELECT * INTO v_approval_rule FROM public.get_approval_margin_rule(COALESCE(p_margin_cents, 0));
    v_required_profiles := COALESCE(v_approval_rule.required_profiles, ARRAY[]::text[]);

    -- Perfis que já atuaram
    SELECT COALESCE(array_agg(DISTINCT up.perfil), ARRAY[]::text[])
    INTO v_already_acted_profiles
    FROM public.approval_history ah
    JOIN public.user_profiles up ON up.user_id = ah.approver_id::text
    WHERE ah.suggestion_id = p_request_id
      AND ah.action IN ('approved', 'rejected');

    -- ROTEAMENTO DIRETO por regra de margem
    IF array_length(v_required_profiles, 1) > 0 THEN
        FOREACH v_next_profile IN ARRAY v_required_profiles LOOP
            IF v_next_profile = ANY(v_already_acted_profiles) THEN CONTINUE; END IF;

            SELECT user_id, email, nome INTO v_next_user
            FROM public.user_profiles
            WHERE perfil = v_next_profile AND ativo = true
              AND user_id::text != COALESCE(v_creator_uuid::text, '')
            LIMIT 1;

            IF v_next_user.user_id IS NULL THEN CONTINUE; END IF;

            v_i := 1;
            FOR j IN 1..array_length(v_approval_order, 1) LOOP
                IF v_approval_order[j] = v_next_profile THEN v_i := j; EXIT; END IF;
            END LOOP;

            RETURN json_build_object(
                'found', true, 'level', v_i, 'profile', v_next_profile,
                'user_id', v_next_user.user_id,
                'user_name', COALESCE(v_next_user.nome, v_next_user.email, 'Perfil: ' || v_next_profile)
            );
        END LOOP;
    END IF;

    -- FALLBACK: chain normal
    FOR i IN (p_current_level + 1)..array_length(v_approval_order, 1) LOOP
        v_next_profile := v_approval_order[i];
        IF v_next_profile = ANY(v_already_acted_profiles) THEN CONTINUE; END IF;

        SELECT user_id, email, nome INTO v_next_user
        FROM public.user_profiles
        WHERE perfil = v_next_profile AND ativo = true
          AND user_id::text != COALESCE(v_creator_uuid::text, '')
        LIMIT 1;

        IF v_next_user.user_id IS NULL THEN CONTINUE; END IF;

        RETURN json_build_object(
            'found', true, 'level', i, 'profile', v_next_profile,
            'user_id', v_next_user.user_id,
            'user_name', COALESCE(v_next_user.nome, v_next_user.email, 'Perfil: ' || v_next_profile)
        );
    END LOOP;

    RETURN json_build_object('found', false);
END;
$$;


-- (D) _can_profile_finalize
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
    v_req_evidence boolean;
    v_max_disc_evidence_cents integer;
BEGIN
    SELECT margin_cents, attachments INTO v_request_margin, v_attachments
    FROM public.price_suggestions WHERE id = p_suggestion_id;

    v_has_evidence := (v_attachments IS NOT NULL AND array_length(v_attachments, 1) > 0);

    SELECT * INTO v_approval_rule FROM public.get_approval_margin_rule(COALESCE(v_request_margin, 0));
    v_required_profiles := COALESCE(v_approval_rule.required_profiles, ARRAY[]::text[]);

    IF array_length(v_required_profiles, 1) > 0 THEN
        IF NOT (p_profile = ANY(v_required_profiles)) THEN RETURN false; END IF;
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


-- ============================================================================
-- PASSO 5: RPCs PRINCIPAIS — TODAS com p_request_id TEXT (PostgREST compatível)
-- ============================================================================

-- (1) CREATE PRICE REQUEST
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
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    IF v_total_cost IS NOT NULL AND v_total_cost > 0 THEN
        v_margin_cents := ((p_final_price - v_total_cost) * 100)::integer;
    END IF;

    SELECT perfil INTO v_initial_profile FROM public.approval_profile_order
    WHERE order_position = 1 AND is_active = true LIMIT 1;
    v_initial_profile := COALESCE(v_initial_profile, 'supervisor_comercial');

    SELECT user_id, nome, email INTO v_initial_approver
    FROM public.user_profiles WHERE perfil = v_initial_profile AND ativo = true
      AND user_id::text != v_user_id::text
    LIMIT 1;

    INSERT INTO public.price_suggestions (
        station_id, product, final_price, current_price, purchase_cost, freight_cost,
        cost_price, margin_cents, suggested_price, client_id, payment_method_id,
        observations, status, created_by, price_origin_base, price_origin_uf,
        price_origin_delivery, price_origin_bandeira, price_origin_code,
        batch_id, batch_name, volume_made, volume_projected,
        arla_purchase_price, arla_cost_price, approval_level, approvals_count,
        total_approvers, current_approver_id, current_approver_name, evidence_url
    ) VALUES (
        p_station_id, p_product::public.product_type, p_final_price, p_current_price,
        v_purchase_cost, v_freight_cost, v_total_cost, v_margin_cents, p_final_price,
        p_client_id, p_payment_method_id, p_observations, p_status::public.approval_status,
        v_user_id, v_base_nome, v_base_uf, v_forma_entrega, v_base_bandeira, v_base_codigo,
        p_batch_id, p_batch_name, p_volume_made, p_volume_projected,
        p_arla_purchase_price, p_arla_cost_price, 1, 0, 1,
        v_initial_approver.user_id,
        COALESCE(v_initial_approver.nome, v_initial_approver.email, 'Perfil: ' || v_initial_profile),
        p_evidence_url
    ) RETURNING * INTO v_new_request;

    IF v_initial_approver.user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (v_initial_approver.user_id, 'Nova Solicitação de Preço',
                'Nova solicitação aguardando sua aprovação.', 'approval_pending', v_new_request.id, false);
    END IF;

    RETURN v_new_request;
END;
$$;


-- (2) APPROVE PRICE REQUEST *** p_request_id TEXT ***
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
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
    IF v_request.status NOT IN ('pending', 'appealed') THEN
        RAISE EXCEPTION 'Solicitação não está pendente (status: %)', v_request.status;
    END IF;

    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id::text = v_user_id::text;
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;

    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN
        RAISE EXCEPTION 'Sem permissão de aprovação (perfil: %)', v_profile.perfil;
    END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_current_level := COALESCE(v_request.approval_level, 1);

    -- Loop para auto-skip quando próximo aprovador = aprovador atual
    LOOP
        v_loop_safety := v_loop_safety + 1;
        IF v_loop_safety > 20 THEN RAISE EXCEPTION 'Approval loop limit exceeded'; END IF;

        SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
        v_current_level := COALESCE(v_request.approval_level, 1);

        INSERT INTO public.approval_history (
            suggestion_id, approver_id, approver_name, action, approval_level, observations
        ) VALUES (v_id, v_user_id, v_approver_name, 'approved', v_current_level, p_observations);

        v_can_finalize := public._can_profile_finalize(v_profile.perfil, v_id);

        IF v_can_finalize THEN
            UPDATE public.price_suggestions
            SET status = 'approved', approved_by = v_user_id, approved_at = now(),
                current_approver_id = v_user_id, current_approver_name = v_approver_name,
                approvals_count = COALESCE(approvals_count, 0) + 1,
                last_approver_action_by = v_user_id, last_observation = p_observations
            WHERE id = v_id;

            IF v_request.created_by IS NOT NULL THEN
                BEGIN
                    INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
                    VALUES (public._resolve_user_id(v_request.created_by::text),
                            'Solicitação Aprovada ✅', v_approver_name || ' aprovou sua solicitação.',
                            'request_approved', v_id, false);
                EXCEPTION WHEN OTHERS THEN NULL;
                END;
            END IF;

            RETURN json_build_object('success', true, 'status', 'approved');
        ELSE
            v_next_approver := public._find_next_approver(
                v_id, v_request.created_by::text, v_current_level, COALESCE(v_request.margin_cents, 0)
            );

            IF (v_next_approver->>'found')::boolean THEN
                IF (v_next_approver->>'user_id')::uuid = v_user_id THEN
                    -- Mesmo aprovador no próximo nível, auto-skip
                    UPDATE public.price_suggestions
                    SET approval_level = (v_next_approver->>'level')::integer,
                        approvals_count = COALESCE(approvals_count, 0) + 1
                    WHERE id = v_id;
                    CONTINUE;
                ELSE
                    UPDATE public.price_suggestions
                    SET approval_level = (v_next_approver->>'level')::integer,
                        current_approver_id = (v_next_approver->>'user_id')::uuid,
                        current_approver_name = v_next_approver->>'user_name',
                        approvals_count = COALESCE(approvals_count, 0) + 1,
                        last_approver_action_by = v_user_id,
                        last_observation = p_observations, status = 'pending'
                    WHERE id = v_id;

                    INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
                    VALUES ((v_next_approver->>'user_id')::uuid, 'Nova Aprovação Pendente',
                            'Solicitação nível ' || (v_next_approver->>'level'),
                            'approval_pending', v_id, false);

                    RETURN json_build_object('success', true, 'status', 'pending',
                                              'nextLevel', (v_next_approver->>'level')::integer);
                END IF;
            ELSE
                UPDATE public.price_suggestions
                SET status = 'approved', approved_by = v_user_id, approved_at = now(),
                    current_approver_id = v_user_id, current_approver_name = v_approver_name,
                    approvals_count = COALESCE(approvals_count, 0) + 1,
                    last_approver_action_by = v_user_id, last_observation = p_observations
                WHERE id = v_id;
                RETURN json_build_object('success', true, 'status', 'approved');
            END IF;
        END IF;
    END LOOP;
END;
$$;


-- (3) REJECT PRICE REQUEST *** p_request_id TEXT ***
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
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
    IF v_request.status NOT IN ('pending', 'appealed') THEN
        RAISE EXCEPTION 'Estado inválido: %', v_request.status;
    END IF;

    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id::text = v_user_id::text;
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;
    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN RAISE EXCEPTION 'Sem permissão'; END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_current_level := COALESCE(v_request.approval_level, 1);

    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (v_id, v_user_id, v_approver_name, 'rejected', v_current_level, p_observations);

    v_next_approver := public._find_next_approver(
        v_id, v_request.created_by::text, v_current_level, COALESCE(v_request.margin_cents, 0)
    );

    IF (v_next_approver->>'found')::boolean THEN
        UPDATE public.price_suggestions
        SET status = 'pending',
            approval_level = (v_next_approver->>'level')::integer,
            current_approver_id = (v_next_approver->>'user_id')::uuid,
            current_approver_name = v_next_approver->>'user_name',
            rejections_count = COALESCE(rejections_count, 0) + 1,
            last_approver_action_by = v_user_id,
            rejection_reason = p_observations, last_observation = p_observations
        WHERE id = v_id;

        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES ((v_next_approver->>'user_id')::uuid, 'Solicitação Escalada',
                v_approver_name || ' rejeitou. Enviada para sua revisão.',
                'approval_pending', v_id, false);

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
            BEGIN
                INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
                VALUES (public._resolve_user_id(v_request.created_by::text),
                        'Solicitação Rejeitada ❌', v_approver_name || ' rejeitou sua solicitação.',
                        'price_rejected', v_id, false);
            EXCEPTION WHEN OTHERS THEN NULL;
            END;
        END IF;

        RETURN json_build_object('success', true, 'status', 'rejected', 'action', 'terminated');
    END IF;
END;
$$;


-- (4) SUGGEST PRICE *** p_request_id TEXT ***
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
    v_new_margin integer;
BEGIN
    v_user_id := auth.uid();

    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
    IF v_request.status NOT IN ('pending', 'appealed') THEN RAISE EXCEPTION 'Estado inválido'; END IF;

    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id::text = v_user_id::text;
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;
    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN RAISE EXCEPTION 'Sem permissão'; END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_new_margin := ((p_suggested_price - COALESCE(v_request.cost_price, 0)) * 100)::integer;

    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (v_id, v_user_id, v_approver_name, 'price_suggested',
              COALESCE(v_request.approval_level, 1),
              COALESCE(p_observations, '') || ' | Sugerido: R$ ' || p_suggested_price::text);

    UPDATE public.price_suggestions
    SET status = 'price_suggested', suggested_price = p_suggested_price,
        final_price = p_suggested_price,
        arla_price = COALESCE(p_arla_price, arla_price),
        margin_cents = v_new_margin,
        current_approver_id = v_user_id, current_approver_name = v_approver_name,
        last_approver_action_by = v_user_id, last_observation = p_observations
    WHERE id = v_id;

    IF v_request.created_by IS NOT NULL THEN
        BEGIN
            INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
            VALUES (public._resolve_user_id(v_request.created_by::text),
                    'Preço Sugerido 💰', v_approver_name || ' sugeriu um novo valor.',
                    'price_suggested', v_id, false);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    RETURN json_build_object('success', true, 'status', 'price_suggested');
END;
$$;


-- (5) REQUEST JUSTIFICATION *** p_request_id TEXT ***
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
    v_approver_name text;
BEGIN
    v_user_id := auth.uid();
    IF p_observations IS NULL OR trim(p_observations) = '' THEN RAISE EXCEPTION 'Observações obrigatórias'; END IF;

    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
    IF v_request.status NOT IN ('pending', 'appealed') THEN RAISE EXCEPTION 'Estado inválido'; END IF;

    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id::text = v_user_id::text;
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;
    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN RAISE EXCEPTION 'Sem permissão'; END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');

    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (v_id, v_user_id, v_approver_name, 'request_justification',
              COALESCE(v_request.approval_level, 1), p_observations);

    UPDATE public.price_suggestions
    SET status = 'awaiting_justification',
        last_approver_action_by = v_user_id, last_observation = p_observations
    WHERE id = v_id;

    IF v_request.created_by IS NOT NULL THEN
        BEGIN
            INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
            VALUES (public._resolve_user_id(v_request.created_by::text),
                    'Justificativa Solicitada 📝', v_approver_name || ' solicitou justificativa.',
                    'justification_requested', v_id, false);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    RETURN json_build_object('success', true, 'status', 'awaiting_justification');
END;
$$;


-- (6) REQUEST EVIDENCE *** p_request_id TEXT ***
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
    v_approver_name text;
BEGIN
    v_user_id := auth.uid();

    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
    IF v_request.status NOT IN ('pending', 'appealed') THEN RAISE EXCEPTION 'Estado inválido'; END IF;

    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id::text = v_user_id::text;
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;
    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN RAISE EXCEPTION 'Sem permissão'; END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');

    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (v_id, v_user_id, v_approver_name, 'request_evidence',
              COALESCE(v_request.approval_level, 1),
              COALESCE(p_observations, '') || ' | Produto: ' || COALESCE(p_product, 'principal'));

    UPDATE public.price_suggestions
    SET status = 'awaiting_evidence', evidence_product = p_product,
        last_approver_action_by = v_user_id, last_observation = p_observations
    WHERE id = v_id;

    IF v_request.created_by IS NOT NULL THEN
        BEGIN
            INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
            VALUES (public._resolve_user_id(v_request.created_by::text),
                    'Referência Solicitada 📎', v_approver_name || ' solicitou referência de preço.',
                    'evidence_requested', v_id, false);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    RETURN json_build_object('success', true, 'status', 'awaiting_evidence', 'evidenceProduct', p_product);
END;
$$;


-- (7) PROVIDE EVIDENCE *** p_request_id TEXT ***
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
    v_profile public.user_profiles;
    v_requester_name text;
    v_current_attachments text[];
    v_creator_uuid uuid;
BEGIN
    v_user_id := auth.uid();

    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
    IF v_request.status != 'awaiting_evidence' THEN RAISE EXCEPTION 'Estado inválido'; END IF;

    -- Autorização: só o criador pode enviar referência
    v_creator_uuid := public._resolve_user_id(v_request.created_by::text);
    IF v_creator_uuid IS NOT NULL AND v_creator_uuid != v_user_id THEN
        RAISE EXCEPTION 'Não autorizado a fornecer evidência';
    END IF;

    SELECT nome, email INTO v_profile FROM public.user_profiles WHERE user_id::text = v_user_id::text;
    v_requester_name := COALESCE(v_profile.nome, v_profile.email, 'Solicitante');

    v_current_attachments := COALESCE(v_request.attachments, ARRAY[]::text[]);
    IF p_attachment_url IS NOT NULL AND p_attachment_url != '' THEN
        v_current_attachments := array_append(v_current_attachments, p_attachment_url);
    END IF;

    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations, attachment_url
    ) VALUES (v_id, v_user_id, v_requester_name, 'evidence_provided',
              v_request.approval_level, COALESCE(p_observations, 'Referência enviada.'), p_attachment_url);

    UPDATE public.price_suggestions
    SET status = 'pending',
        evidence_url = COALESCE(p_attachment_url, evidence_url),
        attachments = v_current_attachments,
        evidence_product = NULL
    WHERE id = v_id;

    IF v_request.last_approver_action_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (v_request.last_approver_action_by, 'Referência Fornecida 📎',
                v_requester_name || ' enviou referência de preço.',
                'evidence_provided', v_id, false);
    END IF;

    RETURN json_build_object('success', true, 'status', 'pending');
END;
$$;


-- (8) PROVIDE JUSTIFICATION *** p_request_id TEXT ***
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
    v_profile public.user_profiles;
    v_requester_name text;
    v_creator_uuid uuid;
BEGIN
    v_user_id := auth.uid();

    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
    IF v_request.status != 'awaiting_justification' THEN RAISE EXCEPTION 'Estado inválido'; END IF;

    -- Autorização: só o criador pode enviar justificativa
    v_creator_uuid := public._resolve_user_id(v_request.created_by::text);
    IF v_creator_uuid IS NOT NULL AND v_creator_uuid != v_user_id THEN
        RAISE EXCEPTION 'Não autorizado a fornecer justificativa';
    END IF;

    SELECT nome, email INTO v_profile FROM public.user_profiles WHERE user_id::text = v_user_id::text;
    v_requester_name := COALESCE(v_profile.nome, v_profile.email, 'Solicitante');

    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (v_id, v_user_id, v_requester_name, 'justification_provided',
              v_request.approval_level, p_justification);

    UPDATE public.price_suggestions
    SET status = 'pending', last_observation = p_justification
    WHERE id = v_id;

    IF v_request.last_approver_action_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (v_request.last_approver_action_by, 'Justificativa Fornecida 💬',
                v_requester_name || ' enviou justificativa.',
                'justification_provided', v_id, false);
    END IF;

    RETURN json_build_object('success', true, 'status', 'pending');
END;
$$;


-- (9) APPEAL *** p_request_id TEXT ***
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
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
    IF v_request.status != 'price_suggested' THEN
        RAISE EXCEPTION 'Já processado (status: %)', v_request.status;
    END IF;

    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (v_id, v_user_id, 'Solicitante (Recurso)', 'appealed',
              v_request.approval_level,
              COALESCE(p_observations, '') || ' | Contraproposta: R$ ' || p_new_price::text);

    UPDATE public.price_suggestions
    SET status = 'appealed', suggested_price = p_new_price,
        arla_price = COALESCE(p_arla_price, arla_price),
        last_observation = p_observations
    WHERE id = v_id;

    IF v_request.current_approver_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (v_request.current_approver_id, 'Recurso de Preço ↩️',
                'O solicitante enviou uma contraproposta.',
                'appealed', v_id, false);
    END IF;

    RETURN json_build_object('success', true, 'status', 'appealed');
END;
$$;


-- (10) ACCEPT SUGGESTED PRICE *** p_request_id TEXT ***
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
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
    IF v_request.status != 'price_suggested' THEN RAISE EXCEPTION 'Estado inválido'; END IF;

    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (v_id, v_user_id, 'Solicitante', 'accepted_suggestion',
              v_request.approval_level, COALESCE(p_observations, 'Aceito.'));

    UPDATE public.price_suggestions
    SET status = 'approved', approved_by = v_request.current_approver_id,
        approved_at = now(), last_approver_action_by = v_user_id,
        last_observation = p_observations
    WHERE id = v_id;

    IF v_request.current_approver_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (v_request.current_approver_id, 'Sugestão Aceita ✅',
                'O solicitante aceitou o preço sugerido.',
                'suggestion_accepted', v_id, false);
    END IF;

    RETURN json_build_object('success', true, 'status', 'approved');
END;
$$;


-- ============================================================================
-- PASSO 6: REGRAS DE MARGEM PADRÃO
-- ============================================================================
INSERT INTO public.approval_margin_rules (
    min_margin_cents, max_margin_cents, required_profiles,
    rule_name, is_active, priority_order
) VALUES (
    0, 34, ARRAY['diretor_comercial', 'diretor_pricing'],
    'Margem baixa - requer aprovação de diretores', true, 100
) ON CONFLICT DO NOTHING;


-- ============================================================================
-- PASSO 7: FORÇAR RELOAD DO CACHE DO PostgREST
-- ============================================================================
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- FIM DA MIGRATION CONSOLIDADA v2
-- ============================================================================
