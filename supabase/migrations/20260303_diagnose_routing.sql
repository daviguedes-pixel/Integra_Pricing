CREATE OR REPLACE FUNCTION public.diagnose_approval_routing()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rules json;
    v_matheus_profiles json;
    v_test_margin_high json;
    v_test_margin_low json;
BEGIN
    -- 1. Get all active rules
    SELECT json_agg(json_build_object(
        'name', rule_name,
        'min', min_margin_cents,
        'max', max_margin_cents,
        'priority', priority_order,
        'req', required_profiles,
        'esc', escalation_profiles
    )) INTO v_rules
    FROM public.approval_margin_rules
    WHERE is_active = true;

    -- 2. Get Matheus profiles
    SELECT json_agg(json_build_object('nome', nome, 'perfil', perfil, 'ativo', ativo))
    INTO v_matheus_profiles
    FROM public.user_profiles 
    WHERE nome ILIKE '%matheus%';

    -- 3. Test High Margin (0.21 = 21 cents)
    SELECT json_build_object(
        'rule_name', rule_name,
        'req_profiles', required_profiles
    ) INTO v_test_margin_high
    FROM public.get_approval_margin_rule(21);

    -- 4. Test Low Margin (0.00 = 0 cents)
    SELECT json_build_object(
        'rule_name', rule_name,
        'req_profiles', required_profiles
    ) INTO v_test_margin_low
    FROM public.get_approval_margin_rule(0);

    RETURN json_build_object(
        'rules', v_rules,
        'matheus', v_matheus_profiles,
        'routing_0_21', v_test_margin_high,
        'routing_0_00', v_test_margin_low
    );
END;
$$;
