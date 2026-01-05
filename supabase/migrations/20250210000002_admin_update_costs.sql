-- Function to admin update approval costs within a date range using TODAY's cost
create or replace function public.admin_update_approval_costs(
    p_start_date date,
    p_end_date date
)
returns json as $$
declare
    v_updated_count int := 0;
    v_record record;
    v_cost numeric;
    v_freight numeric;
    v_lowest_cost record;
    v_processed_ids text[] := array[]::text[];
    v_fee_percentage numeric;
    v_base_price numeric; -- Custo + Frete
    v_final_cost numeric; -- Base + Taxa
    v_margin_cents numeric;
    v_price_suggestion_price numeric; -- Preço sugerido em reais (só pra conta)
    v_today date := current_date; -- Data de hoje para buscar custos
begin
    -- Percorrer todas as aprovações (pendentes ou não, o admin decide) no período
    for v_record in 
        select 
            id, 
            station_id, 
            product, 
            created_at, 
            payment_method_id, 
            suggested_price
        from public.price_suggestions 
        where 
            date(created_at) >= p_start_date 
            and date(created_at) <= p_end_date
            -- Opcional: filtrar apenas aprovados ou pendentes?
            -- Por enquanto, atualiza tudo para garantir que o histórico/relatório esteja correto
    loop
        -- 1. Buscar Custo Base (Produto + Frete) para HOJE (current_date)
        -- A função get_lowest_cost_freight já busca a cotação válida mais próxima <= data (neste caso, hoje)
        begin
            -- Chamar RPC para pegar menor custo usando a data de HOJE
            select custo, frete into v_cost, v_freight
            from public.get_lowest_cost_freight(
                v_record.station_id, 
                v_record.product, 
                v_today -- <<< MUDANÇA AQUI: Passando data de hoje
            )
            limit 1;
            
            -- Se não achou custo, pula ou mantém o atual?
            -- Vamos manter o atual se não achar nada novo
            if v_cost is null then
                continue;
            end if;
            
            -- Tratamento de nulos
            v_cost := coalesce(v_cost, 0);
            v_freight := coalesce(v_freight, 0);
            v_base_price := v_cost + v_freight;
            
        exception when others then
            -- Se der erro na busca de custo, pula este registro
            continue;
        end;

        -- 2. Calcular Custo Financeiro (Taxa)
        v_fee_percentage := 0;
        
        if v_record.payment_method_id is not null then
            -- Tentar pegar taxa específica do posto
            select taxa into v_fee_percentage
            from cotacao.tipos_pagamento 
            where (id::text = v_record.payment_method_id or cartao = v_record.payment_method_id)
            and (id_posto::text = v_record.station_id or posto_id_interno = v_record.station_id) -- Ajustar conforme sua coluna de link
            limit 1;
            
            -- Se não achou específica, tentar geral (public.payment_methods)
            if v_fee_percentage is null then
               select fee_percentage into v_fee_percentage
               from public.payment_methods 
               where id::text = v_record.payment_method_id 
               or name = v_record.payment_method_id; -- Fallback se ID for nome
            end if;
        end if;
        
        v_fee_percentage := coalesce(v_fee_percentage, 0);
        
        -- 3. Custo Final = Base * (1 + Taxa/100)
        v_final_cost := v_base_price * (1 + v_fee_percentage / 100);
        
        -- 4. Recalcular Margem (em centavos)
        -- suggested_price está em centavos no banco
        v_price_suggestion_price := v_record.suggested_price / 100.0;
        v_margin_cents := (v_price_suggestion_price - v_final_cost) * 100;
        
        -- 5. Atualizar Registro
        update public.price_suggestions
        set 
            cost_price = v_base_price, -- Custo de Compra + Frete
            -- Se tiver campos separados de purchase_cost e freight_cost, atualize-os também se desejar
            -- freight_cost = v_freight, 
            -- purchase_cost = v_cost
            margin_value = v_margin_cents, 
            -- Opcional: salvar timestamp de última atualização de custo?
            metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('cost_updated_at', now(), 'cost_updated_base_date', v_today)
        where id = v_record.id;
        
        v_updated_count := v_updated_count + 1;
        
    end loop;

    return json_build_object(
        'success', true, 
        'updated_count', v_updated_count,
        'message', 'Custos atualizados com base na data de hoje'
    );
end;
$$ language plpgsql security definer;
