-- Rewriting create_price_request to dynamically set the first approver
-- based on the margin rules, instead of hardcoding supervisor_comercial.

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
    v_margin_cents integer := COALESCE(p_margin_cents, 0);
    
    v_base_nome text := 'Manual';
    v_base_uf text := '';
    v_forma_entrega text := '';
    v_base_bandeira text := '';
    v_base_codigo text := '';

    v_initial_approver json;
    v_next_user_id uuid;
    v_next_user_name text;
    v_status text := p_status;
BEGIN
    v_user_id := auth.uid();
    IF p_station_id IS NULL OR p_product IS NULL OR p_final_price IS NULL OR p_final_price <= 0 THEN
        RAISE EXCEPTION 'Missing required fields: station_id, product, or final_price > 0';
    END IF;

    -- Fetch latest cost if not provided
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

    -- Recalculate margin
    IF v_total_cost IS NOT NULL AND v_total_cost > 0 THEN
        v_margin_cents := ((p_final_price - v_total_cost) * 100)::integer;
    END IF;

    -- Insert request FIRST, so we have an ID for _find_next_approver to use
    -- (We temporarily set the approver to NULL, then we will calculate and UPDATE it right below)
    INSERT INTO public.price_suggestions (
        station_id, product, final_price, current_price, purchase_cost, freight_cost,
        cost_price, margin_cents, suggested_price, client_id, payment_method_id,
        observations, status, created_by, price_origin_base, price_origin_uf,
        price_origin_delivery, price_origin_bandeira, price_origin_code,
        batch_id, batch_name, volume_made, volume_projected,
        arla_purchase_price, arla_cost_price, approval_level, approvals_count,
        total_approvers, evidence_url
    ) VALUES (
        p_station_id, p_product::public.product_type, p_final_price, p_current_price,
        v_purchase_cost, v_freight_cost, v_total_cost, v_margin_cents, p_final_price,
        p_client_id, p_payment_method_id, p_observations, p_status::public.approval_status,
        v_user_id, v_base_nome, v_base_uf, v_forma_entrega, v_base_bandeira, v_base_codigo,
        p_batch_id, p_batch_name, p_volume_made, p_volume_projected,
        p_arla_purchase_price, p_arla_cost_price, 1, 0, 1, p_evidence_url
    ) RETURNING * INTO v_new_request;

    -- Find the true first approver dynamically based on Margin Rules
    v_initial_approver := public._find_next_approver(v_new_request.id, v_user_id::text, 0, v_margin_cents);

    IF (v_initial_approver->>'found')::boolean THEN
        v_next_user_id := (v_initial_approver->>'user_id')::uuid;
        v_next_user_name := v_initial_approver->>'user_name';
        
        UPDATE public.price_suggestions
        SET current_approver_id = v_next_user_id,
            current_approver_name = v_next_user_name
        WHERE id = v_new_request.id;

        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (v_next_user_id, 'Nova Solicitação de Preço',
                'Nova solicitação aguardando sua aprovação.', 'approval_pending', v_new_request.id, false);
    ELSE
        -- If no approver is found (e.g. no rules require approval for this margin), auto-approve it
        v_status := 'approved';
        
        UPDATE public.price_suggestions
        SET status = 'approved',
            approved_by = v_user_id,
            approved_at = now()
        WHERE id = v_new_request.id;
    END IF;

    -- Refresh variable to return back to caller
    SELECT * INTO v_new_request FROM public.price_suggestions WHERE id = v_new_request.id;
    
    RETURN v_new_request;
END;
$$;

NOTIFY pgrst, 'reload schema';
