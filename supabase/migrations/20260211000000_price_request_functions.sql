-- Migration: Price Request RPC Functions
-- This replaces the logic in RequestService.ts

-- 1. Function to get approval margin rules (helper)
CREATE OR REPLACE FUNCTION public.get_approval_margin_rule(margin_cents integer)
RETURNS SETOF public.approval_margin_rules
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.approval_margin_rules
  WHERE is_active = true
    AND (min_margin_cents IS NULL OR margin_cents >= min_margin_cents)
  ORDER BY priority_order ASC
  LIMIT 1;
$$;

-- 2. Function to create a price request
-- Drop old function signature to avoid ambiguity (it was using UUIDs)
DROP FUNCTION IF EXISTS public.create_price_request(uuid, text, numeric, integer, uuid, uuid, text, text);
-- Drop previous text signature to update with new columns
DROP FUNCTION IF EXISTS public.create_price_request(text, text, numeric, integer, text, text, text, text);
-- Drop previous 11-parameter signature
DROP FUNCTION IF EXISTS public.create_price_request(text, text, numeric, integer, text, text, text, text, numeric, numeric, numeric);

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
    p_arla_cost_price numeric DEFAULT 0
)
RETURNS public.price_suggestions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_new_request public.price_suggestions;
    v_cost_data record;
    v_purchase_cost numeric;
    v_freight_cost numeric;
    v_total_cost numeric;
    v_margin_cents integer := p_margin_cents;
    
    v_base_nome text := 'Manual';
    v_base_uf text := '';
    v_forma_entrega text := '';
    v_base_bandeira text := '';
    v_base_codigo text := '';
BEGIN
    v_user_id := auth.uid();
    
    -- Basic validation
    IF p_station_id IS NULL OR p_product IS NULL OR p_final_price IS NULL OR p_final_price <= 0 THEN
        RAISE EXCEPTION 'Missing required fields or invalid price: station_id, product, or final_price > 0';
    END IF;

    -- Initialize costs with passed values
    v_purchase_cost := p_purchase_cost;
    v_freight_cost := p_freight_cost;
    v_total_cost := p_cost_price;

    -- Try to fetch current costs from get_lowest_cost_freight to fill IF passed values are zero
    IF v_purchase_cost = 0 OR v_total_cost = 0 THEN
        BEGIN
            SELECT custo, frete, custo_total, base_nome, base_uf, forma_entrega, base_bandeira, base_codigo
            INTO v_cost_data
            FROM public.get_lowest_cost_freight(p_station_id, p_product)
            LIMIT 1;

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
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not fetch lowest cost freight, using passed values';
        END;
    END IF;
        
    -- Recalculate margin in cents: (final_price - total_cost) * 100
    IF v_total_cost IS NOT NULL AND v_total_cost > 0 THEN
        v_margin_cents := ((p_final_price - v_total_cost) * 100)::integer;
    ELSE
        v_total_cost := COALESCE(v_total_cost, 0);
    END IF;

    -- Insert request with enriched cost data
    INSERT INTO public.price_suggestions (
        station_id,
        product,
        final_price,
        purchase_cost,
        freight_cost,
        cost_price,
        margin_cents,
        client_id,
        payment_method_id,
        observations,
        status,
        created_by,
        price_origin_base,
        price_origin_uf,
        price_origin_delivery,
        price_origin_bandeira,
        price_origin_code,
        batch_id,
        batch_name,
        volume_made,
        volume_projected,
        arla_purchase_price,
        arla_cost_price,
        approval_level,
        approvals_count,
        total_approvers
    ) VALUES (
        p_station_id,
        p_product::public.product_type,
        p_final_price,
        v_purchase_cost,
        v_freight_cost,
        v_total_cost,
        v_margin_cents,
        p_client_id,
        p_payment_method_id,
        p_observations,
        p_status::public.approval_status,
        v_user_id,
        v_base_nome,
        v_base_uf,
        v_forma_entrega,
        v_base_bandeira,
        v_base_codigo,
        p_batch_id,
        p_batch_name,
        p_volume_made,
        p_volume_projected,
        p_arla_purchase_price,
        p_arla_cost_price,
        1,
        0,
        1
    ) RETURNING * INTO v_new_request;

    RETURN v_new_request;
END;
$$;


-- 3. Function to approve a price request
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
    v_approval_rule record;
    v_approval_order text[];
    v_current_level integer;
    v_required_profiles text[];
    v_next_level integer := NULL;
    v_next_profile text := NULL;
    v_next_user record;
    v_new_status text;
BEGIN
    v_user_id := auth.uid();
    
    -- 1. Fetch Request
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    IF v_request.status != 'pending' THEN RAISE EXCEPTION 'Request is not pending approval'; END IF;

    -- 2. Fetch User Profile & Permissions
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE id = v_user_id; -- Assuming ID is user_id in permissions table

    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN
        RAISE EXCEPTION 'User does not have approval permissions';
    END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');

    -- 3. Load Approval Rules & Order
    SELECT * INTO v_approval_rule FROM public.get_approval_margin_rule(v_request.margin_cents);
    
    SELECT array_agg(perfil ORDER BY order_position ASC) INTO v_approval_order 
    FROM public.approval_profile_order WHERE is_active = true;

    IF v_approval_order IS NULL OR array_length(v_approval_order, 1) = 0 THEN
        v_approval_order := ARRAY['analista_pricing', 'supervisor_comercial', 'diretor_comercial', 'diretor_pricing'];
    END IF;

    -- 4. Determine Logic
    v_current_level := COALESCE(v_request.approval_level, 1);
    v_required_profiles := COALESCE(v_approval_rule.required_profiles, ARRAY[]::text[]);

    -- Log to history
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
        'approved',
        v_current_level,
        p_observations
    );

    -- Calculate Next Level
    IF array_length(v_required_profiles, 1) > 0 THEN
        FOR i IN (v_current_level + 1)..array_length(v_approval_order, 1) LOOP
            IF v_approval_order[i] = ANY(v_required_profiles) THEN
                v_next_level := i;
                v_next_profile := v_approval_order[i];
                EXIT;
            END IF;
        END LOOP;
    ELSE
        IF v_current_level < array_length(v_approval_order, 1) THEN
            v_next_level := v_current_level + 1;
            v_next_profile := v_approval_order[v_next_level];
        END IF;
    END IF;

    -- 5. Update Request
    IF v_next_level IS NOT NULL AND v_next_profile IS NOT NULL THEN
        -- Find a user for the next profile
        SELECT user_id, email, nome INTO v_next_user 
        FROM public.user_profiles 
        WHERE perfil = v_next_profile AND ativo = true 
        LIMIT 1;

        UPDATE public.price_suggestions
        SET approval_level = v_next_level,
            current_approver_id = v_next_user.user_id,
            current_approver_name = COALESCE(v_next_user.nome, v_next_user.email, 'Perfil: ' || v_next_profile)
        WHERE id = p_request_id;

        -- Notify Next Approver
        IF v_next_user.user_id IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
            VALUES (
                v_next_user.user_id,
                'Nova Aprovação Pendente',
                'Solicitação aguardando sua aprovação (Nível ' || v_next_level || ')',
                'approval_pending',
                p_request_id,
                false
            );
        END IF;

        RETURN json_build_object('success', true, 'status', 'pending', 'nextLevel', v_next_level);
    ELSE
        -- Final Approval
        UPDATE public.price_suggestions
        SET status = 'approved',
            approved_by = v_user_id,
            approved_at = now(),
            current_approver_id = v_user_id,
            approvals_count = COALESCE(approvals_count, 0) + 1
        WHERE id = p_request_id;

        -- Notify Requester
        IF v_request.created_by IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
            VALUES (
                v_request.created_by,
                'Solicitação Aprovada',
                'Sua solicitação de preço foi aprovada por ' || v_approver_name,
                'request_approved',
                p_request_id,
                false
            );
        END IF;

        RETURN json_build_object('success', true, 'status', 'approved');
    END IF;
END;
$$;

-- 4. Function to reject a price request
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
    v_request record;
    v_profile record;
    v_approver_name text;
    v_rejection_action text;
    v_approval_order text[];
    v_next_level integer;
    v_next_profile text;
    v_next_user record;
BEGIN
    v_user_id := auth.uid();
    
    -- 1. Fetch Request
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

    -- 2. Fetch User Profile
    SELECT nome, email INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');

    -- 3. Log History
    INSERT INTO public.approval_history (
        suggestion_id,
        approver_id,
        approver_name,
        action,
        observations,
        approval_level
    ) VALUES (
        p_request_id,
        v_user_id,
        v_approver_name,
        'rejected',
        p_observations,
        v_request.approval_level
    );

    -- 4. Check Rejection Setting
    SELECT value INTO v_rejection_action FROM public.approval_settings WHERE key = 'rejection_action';
    v_rejection_action := COALESCE(v_rejection_action, 'terminate');

    IF v_rejection_action = 'escalate' THEN
        SELECT array_agg(perfil ORDER BY order_position ASC) INTO v_approval_order 
        FROM public.approval_profile_order WHERE is_active = true;
        
        IF v_approval_order IS NULL OR array_length(v_approval_order, 1) = 0 THEN
            v_approval_order := ARRAY['analista_pricing', 'supervisor_comercial', 'diretor_comercial', 'diretor_pricing'];
        END IF;

        v_next_level := v_request.approval_level + 1;

        IF v_next_level <= array_length(v_approval_order, 1) THEN
            v_next_profile := v_approval_order[v_next_level];

            SELECT user_id, email, nome INTO v_next_user 
            FROM public.user_profiles 
            WHERE perfil = v_next_profile AND ativo = true 
            LIMIT 1;

            UPDATE public.price_suggestions
            SET status = 'pending',
                approval_level = v_next_level,
                rejections_count = COALESCE(rejections_count, 0) + 1,
                current_approver_id = v_next_user.user_id,
                current_approver_name = COALESCE(v_next_user.nome, v_next_user.email, 'Perfil: ' || v_next_profile)
            WHERE id = p_request_id;

            IF v_next_user.user_id IS NOT NULL THEN
                INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
                VALUES (
                    v_next_user.user_id,
                    'Solicitação Rejeitada - Escalada',
                    'Uma solicitação foi rejeitada e escalada para sua revisão (Nível ' || v_next_level || ')',
                    'approval_pending',
                    p_request_id,
                    false
                );
            END IF;

            RETURN json_build_object('success', true, 'status', 'pending', 'action', 'escalated');
        END IF;
    END IF;

    -- Terminate Logic (Default)
    UPDATE public.price_suggestions
    SET status = 'rejected',
        approved_by = v_user_id,
        approved_at = now(),
        current_approver_id = NULL,
        current_approver_name = NULL,
        rejections_count = COALESCE(rejections_count, 0) + 1
    WHERE id = p_request_id;

    -- Notify Requester
    IF v_request.created_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            v_request.created_by,
            'Solicitação Rejeitada',
            'Sua solicitação de preço foi rejeitada.',
            'price_rejected',
            p_request_id,
            false
        );
    END IF;

    RETURN json_build_object('success', true, 'status', 'rejected', 'action', 'terminated');
END;
$$;
