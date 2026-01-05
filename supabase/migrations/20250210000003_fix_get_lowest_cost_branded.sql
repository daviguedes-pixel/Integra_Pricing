-- Corrigindo get_lowest_cost_freight para respeitar regras de Bandeirado vs Bandeira Branca
-- Bandeirados: Apenas cotacao_combustivel (Tabela específica/contrato)
-- Bandeira Branca: cotacao_geral_combustivel (Spot) ou cotacao_combustivel (Específica)
-- Drop previous version and cascade to dependent functions (like admin_update_approval_costs)
DROP FUNCTION IF EXISTS public.get_lowest_cost_freight(text, text, date) CASCADE;

-- Corrigindo get_lowest_cost_freight para respeitar regras de Bandeirado vs Bandeira Branca
-- Bandeirados: Apenas cotacao_combustivel (Tabela específica/contrato)
-- Bandeira Branca: cotacao_geral_combustivel (Spot) ou cotacao_combustivel (Específica)
CREATE OR REPLACE FUNCTION public.get_lowest_cost_freight(p_posto_id text, p_produto text, p_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(base_id text, base_nome text, base_codigo text, base_uf text, custo numeric, frete numeric, custo_total numeric, forma_entrega text, data_referencia timestamp without time zone, base_bandeira text)
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
BEGIN
  v_clean_posto_id := regexp_replace(p_posto_id, '-\d+\.\d+$', '');
  v_station_name := p_posto_id;

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
  ORDER BY q.data_cotacao DESC NULLS LAST
  LIMIT 1;

  -- Se não achou empresa, retorna vazio ou referência
  IF v_id_empresa IS NOT NULL THEN
    
    -- Se bandeira veio nula da query acima, tenta buscar direto da sis_empresa pelo ID
    IF v_bandeira IS NULL THEN
        SELECT bandeira INTO v_bandeira FROM cotacao.sis_empresa WHERE id_empresa::bigint = v_id_empresa LIMIT 1;
    END IF;

    -- 2. Determinar se é Bandeira Branca
    -- Regra: NULL, Vazio, 'BRANCA', 'BANDEIRA BRANCA'
    IF v_bandeira IS NULL 
       OR TRIM(v_bandeira) = '' 
       OR UPPER(TRIM(v_bandeira)) = 'BANDEIRA BRANCA' 
       OR UPPER(TRIM(v_bandeira)) LIKE '%BANDEIRA BRANCA%'
       OR UPPER(TRIM(v_bandeira)) = 'BRANCA'
       OR UPPER(TRIM(v_bandeira)) LIKE '%BRANCA%' THEN
      v_is_bandeira_branca := true;
      v_final_bandeira := 'BANDEIRA BRANCA';
    ELSE
      v_is_bandeira_branca := false;
      v_final_bandeira := v_bandeira;
    END IF;

    -- 3. Definir Data de Referência (v_latest_date)
    IF UPPER(p_produto) LIKE '%ARLA%' THEN
      -- Logica ARLA (igual para ambos)
      SELECT MAX(DATE(data_cotacao)) INTO v_latest_arla_date
      FROM cotacao.cotacao_arla ca
      WHERE ca.id_empresa::bigint = v_id_empresa;
      
      -- Se achou ARLA, usa data do ARLA. Se não, fallback
      v_latest_date := COALESCE(v_latest_arla_date, DATE '1900-01-01');
      
    ELSIF v_is_bandeira_branca THEN
      -- Bandeira Branca: Maior data entre Geral e Específica
      SELECT GREATEST(
        COALESCE((SELECT MAX(DATE(data_cotacao)) FROM cotacao.cotacao_combustivel WHERE id_empresa=v_id_empresa AND DATE(data_cotacao) <= p_date), DATE '1900-01-01'),
        COALESCE((SELECT MAX(DATE(data_cotacao)) FROM cotacao.cotacao_geral_combustivel WHERE DATE(data_cotacao) <= p_date), DATE '1900-01-01')
      ) INTO v_latest_date;
    ELSE
      -- Bandeirado: Apenas data da Específica (Contrato)
      SELECT 
        COALESCE((SELECT MAX(DATE(data_cotacao)) FROM cotacao.cotacao_combustivel WHERE id_empresa=v_id_empresa AND DATE(data_cotacao) <= p_date), DATE '1900-01-01')
      INTO v_latest_date;
    END IF;

    -- Se a data solicitada (p_date) tiver dados, usa ela. Senão usa a latest encontrada.
    -- (Verificação simplificada: se v_latest_date for válida e não houver dados em p_date, trocamos)
    -- Mas para simplificar e garantir dados: Se não tem nada EM p_date, usamos v_latest_date.
    
    -- Checagem rápida se tem dados na data pedida
    IF v_latest_date > DATE '1900-01-01' THEN
       DECLARE
         v_has_data_today BOOLEAN := FALSE;
       BEGIN
         IF v_is_bandeira_branca THEN
            PERFORM 1 FROM cotacao.cotacao_geral_combustivel cg 
            JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item = gci.id_grupo_codigo_item
            WHERE DATE(cg.data_cotacao) = p_date 
            AND (gci.nome ILIKE '%'||p_produto||'%' OR gci.descricao ILIKE '%'||p_produto||'%')
            LIMIT 1;
            IF FOUND THEN v_has_data_today := TRUE; END IF;
         END IF;

         IF NOT v_has_data_today THEN
            PERFORM 1 FROM cotacao.cotacao_combustivel cc
            JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item = gci.id_grupo_codigo_item
            WHERE cc.id_empresa = v_id_empresa 
            AND DATE(cc.data_cotacao) = p_date
            AND (gci.nome ILIKE '%'||p_produto||'%' OR gci.descricao ILIKE '%'||p_produto||'%')
            LIMIT 1;
            IF FOUND THEN v_has_data_today := TRUE; END IF;
         END IF;
         
         IF NOT v_has_data_today THEN
            p_date := v_latest_date;
         END IF;
       END;
    END IF;


    -- 4. Query Principal
    RETURN QUERY
    WITH cotacoes AS (
      -- Cotação GERAL (Apenas se Bandeira Branca)
      SELECT 
        bf.id_base_fornecedor::text AS base_id,
        COALESCE(bf.nome,'Base')::text AS base_nome,
        COALESCE(bf.codigo_base,'')::text AS base_codigo,
        COALESCE(bf.uf::text,'')::text AS base_uf,
        (cg.valor_unitario-COALESCE(cg.desconto_valor,0))::numeric AS custo,
        COALESCE(fe.frete_real, fe.frete_atual, 0)::numeric AS frete,
        'FOB'::text AS forma_entrega,
        cg.data_cotacao::timestamp AS data_referencia,
        (cg.valor_unitario-COALESCE(cg.desconto_valor,0)) + COALESCE(fe.frete_real, fe.frete_atual, 0)::numeric AS custo_total,
        1::integer AS prioridade
      FROM cotacao.cotacao_geral_combustivel cg
      INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item=gci.id_grupo_codigo_item
      LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor=cg.id_base_fornecedor
      LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa=v_id_empresa AND fe.id_base_fornecedor=cg.id_base_fornecedor AND fe.registro_ativo=true
      WHERE v_is_bandeira_branca = TRUE -- <<< TRAVA PARA BANDEIRA BRANCA
        AND DATE(cg.data_cotacao)=p_date
        AND (gci.nome ILIKE '%'||p_produto||'%' OR gci.descricao ILIKE '%'||p_produto||'%')
        AND UPPER(TRIM(cg.forma_entrega)) = 'FOB'
        AND COALESCE(fe.frete_real, fe.frete_atual, 0) > 0

      UNION ALL

      -- Cotação ESPECÍFICA (Para Bandeirados e Brancas)
      SELECT 
        bf.id_base_fornecedor::text AS base_id,
        COALESCE(bf.nome,'Base')::text AS base_nome,
        COALESCE(bf.codigo_base,'')::text AS base_codigo,
        COALESCE(bf.uf::text,'')::text AS base_uf,
        (cc.valor_unitario-COALESCE(cc.desconto_valor,0))::numeric AS custo,
        COALESCE(fe.frete_real,fe.frete_atual,0)::numeric AS frete,
        'FOB'::text AS forma_entrega,
        cc.data_cotacao::timestamp AS data_referencia,
        (cc.valor_unitario-COALESCE(cc.desconto_valor,0)) + COALESCE(fe.frete_real,fe.frete_atual,0)::numeric AS custo_total,
        2::integer AS prioridade
      FROM cotacao.cotacao_combustivel cc
      INNER JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item=gci.id_grupo_codigo_item
      LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor=cc.id_base_fornecedor
      LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa=cc.id_empresa AND fe.id_base_fornecedor=cc.id_base_fornecedor AND fe.registro_ativo=true
      WHERE cc.id_empresa=v_id_empresa
        AND DATE(cc.data_cotacao)=p_date
        AND (gci.nome ILIKE '%'||p_produto||'%' OR gci.descricao ILIKE '%'||p_produto||'%')
        AND UPPER(TRIM(cc.forma_entrega)) = 'FOB'
        AND COALESCE(fe.frete_real,fe.frete_atual,0) > 0

      UNION ALL

      -- Cotação ARLA (CIF)
      SELECT 
        ca.id_empresa::text AS base_id,
        COALESCE(ca.nome_empresa, 'ARLA')::text AS base_nome,
        ''::text AS base_codigo,
        ''::text AS base_uf,
        ca.valor_unitario::numeric AS custo,
        0::numeric AS frete,
        'CIF'::text AS forma_entrega,
        ca.data_cotacao::timestamp AS data_referencia,
        ca.valor_unitario::numeric AS custo_total,
        1::integer AS prioridade
      FROM cotacao.cotacao_arla ca
      WHERE ca.id_empresa::bigint = v_id_empresa
        AND DATE(ca.data_cotacao) = p_date
        AND UPPER(p_produto) LIKE '%ARLA%'
    )
    SELECT 
      c.base_id, c.base_nome, c.base_codigo, c.base_uf, c.custo, c.frete, c.custo_total, c.forma_entrega, c.data_referencia,
      v_final_bandeira as base_bandeira
    FROM cotacoes c
    ORDER BY c.custo_total ASC, c.prioridade ASC
    LIMIT 1;

  END IF;

  -- Fallback: Referências se não achou nada
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      r.posto_id::text, 'Referência'::text, r.posto_id::text, ''::text,
      r.preco_referencia::numeric, 0::numeric, r.preco_referencia::numeric,
      'FOB'::text, r.created_at::timestamp,
      COALESCE(v_final_bandeira, 'N/A')::text as base_bandeira
    FROM public.referencias r
    WHERE (r.posto_id = p_posto_id OR r.posto_id = v_clean_posto_id OR r.posto_id ILIKE '%'||v_station_name||'%')
      AND r.produto ILIKE '%'||p_produto||'%'
    ORDER BY r.created_at DESC
    LIMIT 1;
  END IF;
END;
$function$;

-- Restaurar função dependente
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
    v_new_flag text; -- Nova bandeira correta
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
            select custo, frete, base_bandeira into v_cost, v_freight, v_new_flag
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
            v_new_flag := coalesce(v_new_flag, 'N/A');
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
            purchase_cost = v_cost,
            freight_cost = v_freight,
            margin_cents = v_margin_cents,
            margin_value = v_margin_cents, -- Manter ambos por redundância
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
$$ language plpgsql security definer;
