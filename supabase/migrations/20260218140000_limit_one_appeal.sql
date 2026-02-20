-- Migration: Limit Appeal to Once per Request
-- Prevents infinite negotiation loops by enforcing a hard limit of 1 appeal per suggestion.

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
    v_appeal_count integer;
BEGIN
    v_user_id := auth.uid();

    -- Use FOR UPDATE to lock the row immediately
    SELECT * INTO v_request FROM public.price_suggestions 
    WHERE id = p_request_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

    -- Strict Status Check
    IF v_request.status NOT IN ('price_suggested') THEN
        RAISE EXCEPTION 'Request is already processed (Status: %)', v_request.status;
    END IF;

    -- CHECK APPEAL LIMIT
    -- We allow 0 past appeals. If 1 or more exist, block.
    SELECT COUNT(*) INTO v_appeal_count
    FROM public.approval_history
    WHERE suggestion_id = p_request_id 
      AND action = 'appealed';

    IF v_appeal_count >= 1 THEN
        RAISE EXCEPTION 'Limite de recursos excedido. Apenas 1 recurso é permitido por solicitação. Você deve aceitar ou rejeitar a contraproposta.';
    END IF;

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, 'Solicitante (Recurso)', 'appealed',
        v_request.approval_level,
        COALESCE(p_observations, '') || ' | Contraproposta: R$ ' || p_new_price::text
    );

    -- 4. Update request status
    UPDATE public.price_suggestions
    SET status = 'appealed',
        suggested_price = p_new_price,
        last_observation = p_observations
    WHERE id = p_request_id;

    -- 5. Notify Approver
    IF v_request.current_approver_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            v_request.current_approver_id,
            'Recurso de Preço ↩️',
            'O solicitante enviou uma contraproposta/recurso.',
            'appealed',
            p_request_id,
            false
        );
    END IF;

    RETURN json_build_object('success', true, 'status', 'appealed', 'newPrice', p_new_price);
END;
$$;
