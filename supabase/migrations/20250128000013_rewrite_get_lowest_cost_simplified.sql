-- Reescrever get_lowest_cost_freight para usar a lógica simplificada
-- Buscar o menor custo combinando cotacao_geral_combustivel e cotacao_combustivel
-- Apenas FOB com frete cadastrado (abandonando CIF)
CREATE OR REPLACE FUNCTION public.get_lowest_cost_freight(p_posto_id text, p_produto text, p_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(base_id text, base_nome text, base_codigo text, base_uf text, custo numeric, frete numeric, custo_total numeric, forma_entrega text, data_referencia timestamp without time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cotacao'
AS $function$
DECLARE
  v_id_empresa BIGINT;
  v_station_name TEXT;
  v_latest_date DATE;
  v_clean_posto_id TEXT;
  v_latest_arla_date DATE;
BEGIN
  v_clean_posto_id := regexp_replace(p_posto_id, '-\d+\.\d+$', '');
  v_station_name := p_posto_id;

  -- Buscar id_empresa
  SELECT q.id_empresa INTO v_id_empresa FROM (
    SELECT cc.id_empresa, cc.data_cotacao
    FROM cotacao.cotacao_combustivel cc
    WHERE (cc.company_code = p_posto_id OR cc.company_code = v_clean_posto_id OR cc.nome_empresa ILIKE '%'||v_station_name||'%')
    UNION ALL
    SELECT se.id_empresa::bigint, NULL::timestamp
    FROM cotacao.sis_empresa se
    WHERE (se.cnpj_cpf = p_posto_id OR se.cnpj_cpf = v_clean_posto_id OR se.nome_empresa ILIKE '%'||v_station_name||'%')
  ) q
  ORDER BY q.data_cotacao DESC NULLS LAST
  LIMIT 1;

  IF v_id_empresa IS NOT NULL THEN
    -- Se for ARLA, buscar a data mais recente disponível primeiro
    IF UPPER(p_produto) LIKE '%ARLA%' THEN
      SELECT MAX(DATE(data_cotacao)) INTO v_latest_arla_date
      FROM cotacao.cotacao_arla ca
      WHERE ca.id_empresa::bigint = v_id_empresa;
      
      IF v_latest_arla_date IS NOT NULL THEN
        p_date := v_latest_arla_date;
      END IF;
    END IF;
    
    -- Buscar a data mais recente disponível se não houver dados na data especificada
    SELECT GREATEST(
      COALESCE((SELECT MAX(DATE(data_cotacao)) FROM cotacao.cotacao_combustivel WHERE id_empresa=v_id_empresa AND DATE(data_cotacao) <= p_date), DATE '1900-01-01'),
      COALESCE((SELECT MAX(DATE(data_cotacao)) FROM cotacao.cotacao_geral_combustivel WHERE DATE(data_cotacao) <= p_date), DATE '1900-01-01'),
      CASE WHEN UPPER(p_produto) LIKE '%ARLA%' THEN COALESCE((SELECT MAX(DATE(data_cotacao)) FROM cotacao.cotacao_arla WHERE id_empresa::bigint=v_id_empresa), DATE '1900-01-01') ELSE DATE '1900-01-01' END
    ) INTO v_latest_date;

    IF v_latest_date > DATE '1900-01-01' THEN
      -- Verificar se há dados na data especificada
      IF NOT EXISTS (
        SELECT 1 FROM cotacao.cotacao_combustivel cc
        INNER JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item=gci.id_grupo_codigo_item
        WHERE cc.id_empresa=v_id_empresa
          AND DATE(cc.data_cotacao)=p_date
          AND (gci.nome ILIKE '%'||p_produto||'%' OR gci.descricao ILIKE '%'||p_produto||'%')
        UNION ALL
        SELECT 1 FROM cotacao.cotacao_geral_combustivel cg
        INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item=gci.id_grupo_codigo_item
        WHERE DATE(cg.data_cotacao)=p_date
          AND (gci.nome ILIKE '%'||p_produto||'%' OR gci.descricao ILIKE '%'||p_produto||'%')
      ) THEN
        p_date := v_latest_date;
      END IF;
    END IF;
    
    RETURN QUERY
    WITH cotacoes AS (
      -- Cotação geral (buscar para todos, não apenas bandeiras brancas)
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
        1::integer AS prioridade  -- Prioridade 1 para cotação geral
      FROM cotacao.cotacao_geral_combustivel cg
      INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item=gci.id_grupo_codigo_item
      LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor=cg.id_base_fornecedor
      LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa=v_id_empresa
        AND fe.id_base_fornecedor=cg.id_base_fornecedor
        AND fe.registro_ativo=true
      WHERE DATE(cg.data_cotacao)=p_date
        AND (gci.nome ILIKE '%'||p_produto||'%' OR gci.descricao ILIKE '%'||p_produto||'%')
        -- Apenas FOB com frete cadastrado
        AND UPPER(TRIM(cg.forma_entrega)) = 'FOB'
        AND COALESCE(fe.frete_real, fe.frete_atual, 0) > 0

      UNION ALL

      -- Cotação específica da empresa
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
        2::integer AS prioridade  -- Prioridade 2 para cotação específica
      FROM cotacao.cotacao_combustivel cc
      INNER JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item=gci.id_grupo_codigo_item
      LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor=cc.id_base_fornecedor
      LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa=cc.id_empresa 
        AND fe.id_base_fornecedor=cc.id_base_fornecedor
        AND fe.registro_ativo=true
      WHERE cc.id_empresa=v_id_empresa
        AND DATE(cc.data_cotacao)=p_date
        AND (gci.nome ILIKE '%'||p_produto||'%' OR gci.descricao ILIKE '%'||p_produto||'%')
        -- Apenas FOB com frete cadastrado
        AND UPPER(TRIM(cc.forma_entrega)) = 'FOB'
        AND COALESCE(fe.frete_real,fe.frete_atual,0) > 0

      UNION ALL

      -- Cotação ARLA (sempre CIF, sem frete)
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
        1::integer AS prioridade  -- Prioridade 1 para ARLA também
      FROM cotacao.cotacao_arla ca
      WHERE ca.id_empresa::bigint = v_id_empresa
        AND DATE(ca.data_cotacao) = p_date
        AND UPPER(p_produto) LIKE '%ARLA%'
    )
    SELECT 
      c.base_id, 
      c.base_nome, 
      c.base_codigo, 
      c.base_uf, 
      c.custo,
      c.frete,
      c.custo_total,
      c.forma_entrega, 
      c.data_referencia
    FROM cotacoes c
    ORDER BY c.custo_total ASC, c.prioridade ASC  -- Ordenar por custo_total primeiro, depois por prioridade
    LIMIT 1;

    -- Se não encontrou nada, tentar com a data mais recente
    IF NOT FOUND AND v_latest_date > DATE '1900-01-01' AND v_latest_date != p_date THEN
      RETURN QUERY
      WITH cotacoes AS (
        -- Cotação geral
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
        LEFT JOIN cotacao.frete_empresa fe ON fe.id_base_fornecedor=cg.id_base_fornecedor
          AND fe.registro_ativo=true
        WHERE DATE(cg.data_cotacao)=v_latest_date
          AND (gci.nome ILIKE '%'||p_produto||'%' OR gci.descricao ILIKE '%'||p_produto||'%')
          AND UPPER(TRIM(cg.forma_entrega)) = 'FOB'
          AND COALESCE(fe.frete_real, fe.frete_atual, 0) > 0

        UNION ALL

        -- Cotação específica da empresa
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
        LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa=cc.id_empresa 
          AND fe.id_base_fornecedor=cc.id_base_fornecedor
          AND fe.registro_ativo=true
        WHERE cc.id_empresa=v_id_empresa
          AND DATE(cc.data_cotacao)=v_latest_date
          AND (gci.nome ILIKE '%'||p_produto||'%' OR gci.descricao ILIKE '%'||p_produto||'%')
          AND UPPER(TRIM(cc.forma_entrega)) = 'FOB'
          AND COALESCE(fe.frete_real,fe.frete_atual,0) > 0

        UNION ALL

        -- Cotação ARLA
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
          AND DATE(ca.data_cotacao) = v_latest_date
          AND UPPER(p_produto) LIKE '%ARLA%'
      )
      SELECT 
        c.base_id, 
        c.base_nome, 
        c.base_codigo, 
        c.base_uf, 
        c.custo,
        c.frete,
        c.custo_total,
        c.forma_entrega, 
        c.data_referencia
      FROM cotacoes c
      ORDER BY c.custo_total ASC, c.prioridade ASC
      LIMIT 1;
    END IF;
  END IF;

  -- Se não encontrou nada, retornar referência se existir
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      r.posto_id::text, 'Referência'::text, r.posto_id::text, ''::text,
      r.preco_referencia::numeric, 0::numeric, r.preco_referencia::numeric,
      'FOB'::text, r.created_at::timestamp
    FROM public.referencias r
    WHERE (r.posto_id = p_posto_id OR r.posto_id = v_clean_posto_id OR r.posto_id ILIKE '%'||v_station_name||'%')
      AND r.produto ILIKE '%'||p_produto||'%'
    ORDER BY r.created_at DESC
    LIMIT 1;
  END IF;
END;
$function$;

