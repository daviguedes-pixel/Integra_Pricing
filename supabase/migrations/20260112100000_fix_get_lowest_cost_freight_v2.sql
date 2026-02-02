-- Versão Corrigida: Ajuste de colunas e busca flexível
DROP FUNCTION IF EXISTS public.get_lowest_cost_freight(text, text, date) CASCADE;

CREATE OR REPLACE FUNCTION public.get_lowest_cost_freight(p_posto_id text, p_produto text, p_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(base_id text, base_nome text, base_codigo text, base_uf text, custo numeric, frete numeric, custo_total numeric, forma_entrega text, data_referencia timestamp without time zone, base_bandeira text, debug_info text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cotacao'
AS $function$
DECLARE
  v_id_empresa BIGINT;
  v_station_name TEXT;
  v_latest_date DATE;
  v_clean_posto_id TEXT;
  v_bandeira TEXT;
  v_is_bandeira_branca BOOLEAN;
  v_latest_arla_date DATE;
  v_final_bandeira TEXT;
  v_debug_info TEXT := '';
  v_original_date DATE := p_date;
  v_clean_product TEXT; 
BEGIN
  v_clean_posto_id := regexp_replace(p_posto_id, '-\d+\.\d+$', '');
  v_station_name := p_posto_id;
  
  -- LIMPEZA DO PRODUTO: Remove termos genéricos para busca flexível
  v_clean_product := UPPER(TRIM(COALESCE(p_produto, '')));
  v_clean_product := REPLACE(v_clean_product, 'DIESEL ', '');
  v_clean_product := REPLACE(v_clean_product, 'GASOLINA ', '');
  v_clean_product := REPLACE(v_clean_product, 'ETANOL ', '');
  v_clean_product := REPLACE(v_clean_product, '-', ''); 

  -- 1. Identificar Empresa e Bandeira
  SELECT q.id_empresa, q.bandeira INTO v_id_empresa, v_bandeira FROM (
    SELECT cc.id_empresa, se.bandeira, cc.data_cotacao
    FROM cotacao.cotacao_combustivel cc
    LEFT JOIN cotacao.sis_empresa se ON se.id_empresa::bigint = cc.id_empresa
    WHERE (cc.company_code = p_posto_id OR cc.company_code = v_clean_posto_id OR cc.nome_empresa ILIKE '%'||v_station_name||'%')
    UNION ALL
    SELECT se.id_empresa::bigint, se.bandeira, NULL::timestamp
    FROM cotacao.sis_empresa se
    WHERE (se.cnpj_cpf = p_posto_id OR se.cnpj_cpf = v_clean_posto_id OR se.nome_empresa ILIKE '%'||v_station_name||'%')
  ) q
  ORDER BY q.data_cotacao DESC NULLS LAST LIMIT 1;

  IF v_id_empresa IS NOT NULL THEN
    IF v_bandeira IS NULL THEN
        SELECT bandeira INTO v_bandeira FROM cotacao.sis_empresa WHERE id_empresa::bigint = v_id_empresa LIMIT 1;
    END IF;

    IF v_bandeira IS NULL OR TRIM(v_bandeira) = '' OR UPPER(TRIM(v_bandeira)) LIKE '%BRANCA%' THEN
      v_is_bandeira_branca := true;
      v_final_bandeira := 'BANDEIRA BRANCA';
    ELSE
      v_is_bandeira_branca := false;
      v_final_bandeira := v_bandeira;
    END IF;

    -- 3. Buscar Última Data com Custo + Frete
    IF v_clean_product LIKE '%ARLA%' THEN
      SELECT MAX(DATE(data_cotacao)) INTO v_latest_arla_date FROM cotacao.cotacao_arla WHERE id_empresa::bigint = v_id_empresa;
      v_latest_date := COALESCE(v_latest_arla_date, DATE '1900-01-01');
    ELSE
      SELECT GREATEST(
        COALESCE((
            SELECT MAX(DATE(cc.data_cotacao)) 
            FROM cotacao.cotacao_combustivel cc
            INNER JOIN cotacao.frete_empresa fe ON fe.id_base_fornecedor = cc.id_base_fornecedor AND fe.id_empresa = v_id_empresa AND fe.registro_ativo = true
            INNER JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item = gci.id_grupo_codigo_item
            WHERE cc.id_empresa = v_id_empresa 
            AND (gci.nome ILIKE '%'||v_clean_product||'%' OR gci.nome ILIKE '%'||p_produto||'%')
            AND DATE(cc.data_cotacao) <= p_date
        ), DATE '1900-01-01'),
        CASE WHEN v_is_bandeira_branca THEN
            COALESCE((
                SELECT MAX(DATE(cg.data_cotacao)) 
                FROM cotacao.cotacao_geral_combustivel cg
                INNER JOIN cotacao.frete_empresa fe ON fe.id_base_fornecedor = cg.id_base_fornecedor AND fe.id_empresa = v_id_empresa AND fe.registro_ativo = true
                INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item = gci.id_grupo_codigo_item
                WHERE (gci.nome ILIKE '%'||v_clean_product||'%' OR gci.nome ILIKE '%'||p_produto||'%')
                AND DATE(cg.data_cotacao) <= p_date
            ), DATE '1900-01-01')
        ELSE DATE '1900-01-01' END
      ) INTO v_latest_date;
    END IF;

    IF v_latest_date > DATE '1900-01-01' AND v_latest_date < p_date THEN
       p_date := v_latest_date;
       v_debug_info := 'Data original s/ cotação com frete. Usando data: ' || v_latest_date;
    END IF;

    -- 4. Retorno Principal
    RETURN QUERY
    WITH cotacoes AS (
      SELECT 
        bf.id_base_fornecedor::text as b_id, bf.nome::text as b_nome, bf.codigo_base::text as b_cod, bf.uf::text as b_uf,
        (cg.valor_unitario-COALESCE(cg.desconto_valor,0))::numeric as b_custo,
        COALESCE(fe.frete_real, fe.frete_atual, 0)::numeric as b_frete,
        (cg.valor_unitario-COALESCE(cg.desconto_valor,0) + COALESCE(fe.frete_real, fe.frete_atual, 0))::numeric as b_total,
        cg.forma_entrega::text as b_forma, cg.data_cotacao::timestamp as b_data, 1 as b_prior
      FROM cotacao.cotacao_geral_combustivel cg
      INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item=gci.id_grupo_codigo_item
      INNER JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor=cg.id_base_fornecedor
      INNER JOIN cotacao.frete_empresa fe ON fe.id_empresa=v_id_empresa AND fe.id_base_fornecedor=cg.id_base_fornecedor AND fe.registro_ativo=true
      WHERE v_is_bandeira_branca = TRUE AND DATE(cg.data_cotacao)=p_date
        AND (gci.nome ILIKE '%'||v_clean_product||'%' OR gci.nome ILIKE '%'||p_produto||'%')
      
      UNION ALL

      SELECT 
        bf.id_base_fornecedor::text, bf.nome::text, bf.codigo_base::text, bf.uf::text,
        (cc.valor_unitario-COALESCE(cc.desconto_valor,0))::numeric,
        COALESCE(fe.frete_real,fe.frete_atual,0)::numeric,
        (cc.valor_unitario-COALESCE(cc.desconto_valor,0) + COALESCE(fe.frete_real,fe.frete_atual,0))::numeric,
        cc.forma_entrega::text, cc.data_cotacao::timestamp, 2
      FROM cotacao.cotacao_combustivel cc
      INNER JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item=gci.id_grupo_codigo_item
      INNER JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor=cc.id_base_fornecedor
      INNER JOIN cotacao.frete_empresa fe ON fe.id_empresa=cc.id_empresa AND fe.id_base_fornecedor=cc.id_base_fornecedor AND fe.registro_ativo=true
      WHERE cc.id_empresa=v_id_empresa AND DATE(cc.data_cotacao)=p_date
        AND (gci.nome ILIKE '%'||v_clean_product||'%' OR gci.nome ILIKE '%'||p_produto||'%')
    )
    SELECT 
      b_id, b_nome, b_cod, b_uf, b_custo, b_frete, b_total, b_forma, b_data, 
      v_final_bandeira, v_debug_info 
    FROM cotacoes 
    ORDER BY b_total ASC, b_prior ASC LIMIT 1;
  END IF;

  -- Fallback Referências
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      r.posto_id::text, 'Referência'::text, r.posto_id::text, ''::text, r.preco_referencia::numeric, 0::numeric, r.preco_referencia::numeric, 
      'FOB'::text, r.created_at::timestamp, COALESCE(v_final_bandeira, 'N/A')::text, 'Custo real não encontrado.' 
    FROM public.referencias r 
    WHERE (r.posto_id = p_posto_id OR r.posto_id = v_clean_posto_id OR r.posto_id ILIKE '%'||v_station_name||'%') 
    AND (r.produto ILIKE '%'||v_clean_product||'%' OR r.produto ILIKE '%'||p_produto||'%') 
    ORDER BY r.created_at DESC LIMIT 1;
  END IF;
END;
$function$;

-- Restaurar função dependente
CREATE OR REPLACE FUNCTION public.admin_update_approval_costs(
    p_start_date date,
    p_end_date date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    v_new_flag text; -- Nova bandeira correta
begin
    -- Percorrer todas as aprovações no período
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
    loop
        -- 1. Buscar Custo Base (Produto + Frete) para HOJE
        begin
            select custo, frete, base_bandeira into v_cost, v_freight, v_new_flag
            from public.get_lowest_cost_freight(v_record.station_id, v_record.product, v_today)
            limit 1;
            
            if v_cost is null then
                continue;
            end if;
            
            v_cost := coalesce(v_cost, 0);
            v_freight := coalesce(v_freight, 0);
            v_new_flag := coalesce(v_new_flag, 'N/A');
            v_base_price := v_cost + v_freight;
            
        exception when others then
            continue;
        end;

        -- 2. Calcular Custo Financeiro (Taxa)
        v_fee_percentage := 0;
        if v_record.payment_method_id is not null then
            select taxa into v_fee_percentage
            from cotacao.tipos_pagamento 
            where (id::text = v_record.payment_method_id or cartao = v_record.payment_method_id)
            and (id_posto::text = v_record.station_id or posto_id_interno = v_record.station_id)
            limit 1;
            
            if v_fee_percentage is null then
               select fee_percentage into v_fee_percentage
               from public.payment_methods 
               where id::text = v_record.payment_method_id 
               or name = v_record.payment_method_id;
            end if;
        end if;
        
        v_fee_percentage := coalesce(v_fee_percentage, 0);
        v_final_cost := v_base_price * (1 + v_fee_percentage / 100);
        v_price_suggestion_price := v_record.suggested_price / 100.0;
        v_margin_cents := (v_price_suggestion_price - v_final_cost) * 100;
        
        update public.price_suggestions
        set 
            cost_price = v_base_price,
            purchase_cost = v_cost,
            freight_cost = v_freight,
            margin_cents = v_margin_cents,
            margin_value = v_margin_cents,
            price_origin_bandeira = v_new_flag,
            metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
                'cost_updated_at', now(), 
                'cost_updated_base_date', v_today,
                'station_brand', v_new_flag
            )
        where id = v_record.id;
        
        v_updated_count := v_updated_count + 1;
    end loop;

    return json_build_object(
        'success', true, 
        'updated_count', v_updated_count,
        'message', 'Custos atualizados com base na data de hoje'
    );
end;
$$;
