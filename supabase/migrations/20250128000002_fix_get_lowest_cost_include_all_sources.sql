-- Corrigir get_lowest_cost_freight para buscar em TODAS as fontes disponíveis
-- Não apenas na cotação específica da empresa, mas também na cotação geral
-- Isso garante que custos mais baratos não sejam ignorados
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
  v_bandeira TEXT;
  v_latest_arla_date DATE;
  v_is_bandeira_branca BOOLEAN;
BEGIN
  v_clean_posto_id := regexp_replace(p_posto_id, '-\d+\.\d+$', '');
  v_station_name := p_posto_id;

  -- Buscar id_empresa e bandeira
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

  IF v_id_empresa IS NOT NULL THEN
    -- Buscar bandeira diretamente do sis_empresa para garantir identificação correta
    SELECT COALESCE(se.bandeira, '') INTO v_bandeira
    FROM cotacao.sis_empresa se
    WHERE se.id_empresa::bigint = v_id_empresa
    LIMIT 1;
    
    -- Identificar se é bandeira branca: NULL, vazio, ou contém "BANDEIRA BRANCA" ou "BRANCA"
    -- Verificar também se contém apenas "BRANCA" (sem "BANDEIRA")
    IF v_bandeira IS NULL 
       OR TRIM(v_bandeira) = '' 
       OR UPPER(TRIM(v_bandeira)) = 'BANDEIRA BRANCA' 
       OR UPPER(TRIM(v_bandeira)) LIKE '%BANDEIRA BRANCA%'
       OR UPPER(TRIM(v_bandeira)) = 'BRANCA'
       OR UPPER(TRIM(v_bandeira)) LIKE '%BRANCA%' THEN
      v_is_bandeira_branca := true;
    ELSE
      v_is_bandeira_branca := false;
    END IF;
    
    -- Se for ARLA, buscar a data mais recente disponível primeiro
    IF UPPER(p_produto) LIKE '%ARLA%' THEN
      SELECT MAX(DATE(data_cotacao)) INTO v_latest_arla_date
      FROM cotacao.cotacao_arla ca
      WHERE ca.id_empresa::bigint = v_id_empresa;
      
      -- Se encontrou data de ARLA, usar ela ao invés de p_date
      IF v_latest_arla_date IS NOT NULL THEN
        p_date := v_latest_arla_date;
      END IF;
    END IF;
    
    -- Para bandeiras brancas, verificar se há dados na cotação geral na data especificada
    -- Se não houver, buscar a data mais recente disponível
    IF v_is_bandeira_branca = true THEN
      SELECT MAX(DATE(data_cotacao)) INTO v_latest_date
      FROM cotacao.cotacao_geral_combustivel cg
      INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item=gci.id_grupo_codigo_item
      WHERE DATE(cg.data_cotacao) <= p_date
        AND (gci.nome ILIKE '%'||p_produto||'%' OR gci.descricao ILIKE '%'||p_produto||'%');
      
      -- Se encontrou uma data mais recente ou se não há dados na data especificada, usar a data mais recente
      IF v_latest_date IS NOT NULL AND v_latest_date != p_date THEN
        -- Verificar se há dados na data especificada
        IF NOT EXISTS (
          SELECT 1 FROM cotacao.cotacao_geral_combustivel cg2
          INNER JOIN cotacao.grupo_codigo_item gci2 ON cg2.id_grupo_codigo_item=gci2.id_grupo_codigo_item
          WHERE DATE(cg2.data_cotacao) = p_date
            AND (gci2.nome ILIKE '%'||p_produto||'%' OR gci2.descricao ILIKE '%'||p_produto||'%')
        ) THEN
          p_date := v_latest_date;
        END IF;
      END IF;
    END IF;
      
      RETURN QUERY
      WITH cotacoes AS (
        -- Para bandeiras brancas: buscar PRIMEIRO na cotação geral (mais barata)
        -- Buscar apenas bases com frete cadastrado OU que sejam CIF (não precisa de frete)
        SELECT 
          bf.id_base_fornecedor::text AS base_id,
          COALESCE(bf.nome,'Base')::text AS base_nome,
          COALESCE(bf.codigo_base,'')::text AS base_codigo,
          COALESCE(bf.uf::text,'')::text AS base_uf,
          (cg.valor_unitario-COALESCE(cg.desconto_valor,0))::numeric AS custo,
          -- Para FOB: usar frete cadastrado
          -- Para CIF: sempre 0
          CASE 
            WHEN cg.forma_entrega = 'FOB' THEN COALESCE(fe.frete_real, fe.frete_atual, 0)
            ELSE 0
          END::numeric AS frete,
          cg.forma_entrega::text AS forma_entrega,
          cg.data_cotacao::timestamp AS data_referencia,
          1::integer AS prioridade,  -- Prioridade 1 para cotação geral
          -- Calcular custo_total na CTE para poder ordenar
          CASE 
            WHEN cg.forma_entrega = 'FOB' THEN 
              (cg.valor_unitario-COALESCE(cg.desconto_valor,0)) + COALESCE(fe.frete_real, fe.frete_atual, 0)
            ELSE 
              (cg.valor_unitario-COALESCE(cg.desconto_valor,0))
          END::numeric AS custo_total
        FROM cotacao.cotacao_geral_combustivel cg
        INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item=gci.id_grupo_codigo_item
        LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor=cg.id_base_fornecedor
        LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa=v_id_empresa AND fe.id_base_fornecedor=cg.id_base_fornecedor AND fe.registro_ativo=true
        WHERE v_is_bandeira_branca = true
          AND DATE(cg.data_cotacao)=p_date
          AND (gci.nome ILIKE '%'||p_produto||'%' OR gci.descricao ILIKE '%'||p_produto||'%')
          -- Buscar apenas quando: é CIF (não precisa de frete) OU é FOB com frete cadastrado
          AND (
            UPPER(TRIM(cg.forma_entrega)) = 'CIF' 
            OR (UPPER(TRIM(cg.forma_entrega)) = 'FOB' AND COALESCE(fe.frete_real,fe.frete_atual,0) > 0)
          )
        UNION ALL
        -- Cotação específica da empresa (buscar para bandeiras brancas também, mas como fallback)
        SELECT 
          bf.id_base_fornecedor::text AS base_id,
          COALESCE(bf.nome,'Base')::text AS base_nome,
          COALESCE(bf.codigo_base,'')::text AS base_codigo,
          COALESCE(bf.uf::text,'')::text AS base_uf,
          (cc.valor_unitario-COALESCE(cc.desconto_valor,0))::numeric AS custo,
          COALESCE(fe.frete_real,fe.frete_atual,0)::numeric AS frete,
          cc.forma_entrega::text AS forma_entrega,
          cc.data_cotacao::timestamp AS data_referencia,
          2::integer AS prioridade,  -- Prioridade 2 para cotação específica
          -- Calcular custo_total na CTE
          CASE 
            WHEN cc.forma_entrega = 'FOB' THEN 
              (cc.valor_unitario-COALESCE(cc.desconto_valor,0)) + COALESCE(fe.frete_real,fe.frete_atual,0)
            ELSE 
              (cc.valor_unitario-COALESCE(cc.desconto_valor,0))
          END::numeric AS custo_total
        FROM cotacao.cotacao_combustivel cc
        INNER JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item=gci.id_grupo_codigo_item
        LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor=cc.id_base_fornecedor
        LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa=cc.id_empresa AND fe.id_base_fornecedor=cc.id_base_fornecedor AND fe.registro_ativo=true
        WHERE cc.id_empresa=v_id_empresa
          AND DATE(cc.data_cotacao)=p_date
          AND (gci.nome ILIKE '%'||p_produto||'%' OR gci.descricao ILIKE '%'||p_produto||'%')
          AND (
            UPPER(TRIM(cc.forma_entrega)) = 'CIF' 
            OR (UPPER(TRIM(cc.forma_entrega)) = 'FOB' AND COALESCE(fe.frete_real,fe.frete_atual,0) > 0)
          )
        UNION ALL
        SELECT 
          ca.id_empresa::text AS base_id,
          COALESCE(ca.nome_empresa, 'ARLA')::text AS base_nome,
          ''::text AS base_codigo,
          ''::text AS base_uf,
          ca.valor_unitario::numeric AS custo,
          0::numeric AS frete,
          'CIF'::text AS forma_entrega,
          ca.data_cotacao::timestamp AS data_referencia,
          1::integer AS prioridade,  -- Prioridade 1 para ARLA também
          ca.valor_unitario::numeric AS custo_total  -- ARLA sempre CIF, então custo_total = custo
        FROM cotacao.cotacao_arla ca
        WHERE ca.id_empresa::bigint = v_id_empresa
          AND DATE(ca.data_cotacao) = p_date
          AND UPPER(p_produto) LIKE '%ARLA%'
      )
      SELECT 
        c.base_id, c.base_nome, c.base_codigo, c.base_uf, c.custo,
        c.frete,  -- Retornar frete diretamente (já calculado corretamente na CTE e filtrado pelo WHERE)
        c.custo_total,
        c.forma_entrega, c.data_referencia
      FROM cotacoes c
      WHERE (UPPER(TRIM(c.forma_entrega)) = 'CIF' OR (UPPER(TRIM(c.forma_entrega)) = 'FOB' AND c.frete > 0))  -- Garantir que FOB só aparece com frete > 0
      ORDER BY c.custo_total ASC, c.prioridade ASC  -- Ordenar por custo_total primeiro, depois por prioridade (cotação geral primeiro)
      LIMIT 1;

      IF NOT FOUND THEN
        SELECT GREATEST(
          COALESCE((SELECT MAX(DATE(data_cotacao)) FROM cotacao.cotacao_combustivel WHERE id_empresa=v_id_empresa), DATE '1900-01-01'),
          CASE WHEN UPPER(p_produto) LIKE '%ARLA%' THEN COALESCE((SELECT MAX(DATE(data_cotacao)) FROM cotacao.cotacao_arla WHERE id_empresa::bigint=v_id_empresa), DATE '1900-01-01') ELSE DATE '1900-01-01' END,
          COALESCE((SELECT MAX(DATE(data_cotacao)) FROM cotacao.cotacao_geral_combustivel), DATE '1900-01-01')
        ) INTO v_latest_date;

        IF v_latest_date > DATE '1900-01-01' THEN
          RETURN QUERY
          WITH cotacoes AS (
            -- Cotação específica da empresa (sempre buscar)
            SELECT 
              bf.id_base_fornecedor::text AS base_id,
              COALESCE(bf.nome,'Base')::text AS base_nome,
              COALESCE(bf.codigo_base,'')::text AS base_codigo,
              COALESCE(bf.uf::text,'')::text AS base_uf,
              (cc.valor_unitario-COALESCE(cc.desconto_valor,0))::numeric AS custo,
              COALESCE(fe.frete_real,fe.frete_atual,0)::numeric AS frete,
              cc.forma_entrega::text AS forma_entrega,
              cc.data_cotacao::timestamp AS data_referencia,
              2::integer AS prioridade,  -- Prioridade 2 para cotação específica
              -- Calcular custo_total na CTE
              CASE 
                WHEN cc.forma_entrega = 'FOB' THEN 
                  (cc.valor_unitario-COALESCE(cc.desconto_valor,0)) + COALESCE(fe.frete_real,fe.frete_atual,0)
                ELSE 
                  (cc.valor_unitario-COALESCE(cc.desconto_valor,0))
              END::numeric AS custo_total
            FROM cotacao.cotacao_combustivel cc
            INNER JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item=gci.id_grupo_codigo_item
            LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor=cc.id_base_fornecedor
            LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa=cc.id_empresa AND fe.id_base_fornecedor=cc.id_base_fornecedor AND fe.registro_ativo=true
            WHERE cc.id_empresa=v_id_empresa
              AND DATE(cc.data_cotacao)=v_latest_date
              AND (gci.nome ILIKE '%'||p_produto||'%' OR gci.descricao ILIKE '%'||p_produto||'%')
              AND (
                UPPER(TRIM(cc.forma_entrega)) = 'CIF' 
                OR (UPPER(TRIM(cc.forma_entrega)) = 'FOB' AND COALESCE(fe.frete_real,fe.frete_atual,0) > 0)
              )
            UNION ALL
            -- Cotação geral (buscar APENAS para bandeiras brancas)
            -- Buscar apenas bases com frete cadastrado OU que sejam CIF (não precisa de frete)
            SELECT 
              bf.id_base_fornecedor::text AS base_id,
              COALESCE(bf.nome,'Base')::text AS base_nome,
              COALESCE(bf.codigo_base,'')::text AS base_codigo,
              COALESCE(bf.uf::text,'')::text AS base_uf,
              (cg.valor_unitario-COALESCE(cg.desconto_valor,0))::numeric AS custo,
              -- Para FOB: usar frete cadastrado
              -- Para CIF: sempre 0
              CASE 
                WHEN cg.forma_entrega = 'FOB' THEN COALESCE(fe.frete_real, fe.frete_atual, 0)
                ELSE 0
              END::numeric AS frete,
              cg.forma_entrega::text AS forma_entrega,
              cg.data_cotacao::timestamp AS data_referencia,
              1::integer AS prioridade,  -- Prioridade 1 para cotação geral
              -- Calcular custo_total na CTE
              CASE 
                WHEN cg.forma_entrega = 'FOB' THEN 
                  (cg.valor_unitario-COALESCE(cg.desconto_valor,0)) + COALESCE(fe.frete_real, fe.frete_atual, 0)
                ELSE 
                  (cg.valor_unitario-COALESCE(cg.desconto_valor,0))
              END::numeric AS custo_total
            FROM cotacao.cotacao_geral_combustivel cg
            INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item=gci.id_grupo_codigo_item
            LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor=cg.id_base_fornecedor
            LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa=v_id_empresa AND fe.id_base_fornecedor=cg.id_base_fornecedor AND fe.registro_ativo=true
            WHERE v_is_bandeira_branca = true
              AND DATE(cg.data_cotacao)=v_latest_date
              AND (gci.nome ILIKE '%'||p_produto||'%' OR gci.descricao ILIKE '%'||p_produto||'%')
              -- Buscar apenas quando: é CIF (não precisa de frete) OU é FOB com frete cadastrado
              AND (
                UPPER(TRIM(cg.forma_entrega)) = 'CIF' 
                OR (UPPER(TRIM(cg.forma_entrega)) = 'FOB' AND COALESCE(fe.frete_real,fe.frete_atual,0) > 0)
              )
            UNION ALL
            -- Cotação específica da empresa (buscar para bandeiras brancas também, mas como fallback)
            SELECT 
              bf.id_base_fornecedor::text AS base_id,
              COALESCE(bf.nome,'Base')::text AS base_nome,
              COALESCE(bf.codigo_base,'')::text AS base_codigo,
              COALESCE(bf.uf::text,'')::text AS base_uf,
              (cc.valor_unitario-COALESCE(cc.desconto_valor,0))::numeric AS custo,
              COALESCE(fe.frete_real,fe.frete_atual,0)::numeric AS frete,
              cc.forma_entrega::text AS forma_entrega,
              cc.data_cotacao::timestamp AS data_referencia,
              2::integer AS prioridade,  -- Prioridade 2 para cotação específica
              -- Calcular custo_total na CTE
              CASE 
                WHEN cc.forma_entrega = 'FOB' THEN 
                  (cc.valor_unitario-COALESCE(cc.desconto_valor,0)) + COALESCE(fe.frete_real,fe.frete_atual,0)
                ELSE 
                  (cc.valor_unitario-COALESCE(cc.desconto_valor,0))
              END::numeric AS custo_total
            FROM cotacao.cotacao_combustivel cc
            INNER JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item=gci.id_grupo_codigo_item
            LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor=cc.id_base_fornecedor
            LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa=cc.id_empresa AND fe.id_base_fornecedor=cc.id_base_fornecedor AND fe.registro_ativo=true
            WHERE cc.id_empresa=v_id_empresa
              AND DATE(cc.data_cotacao)=v_latest_date
              AND (gci.nome ILIKE '%'||p_produto||'%' OR gci.descricao ILIKE '%'||p_produto||'%')
              AND (
                UPPER(TRIM(cc.forma_entrega)) = 'CIF' 
                OR (UPPER(TRIM(cc.forma_entrega)) = 'FOB' AND COALESCE(fe.frete_real,fe.frete_atual,0) > 0)
              )
            UNION ALL
            SELECT 
              ca.id_empresa::text AS base_id,
              COALESCE(ca.nome_empresa, 'ARLA')::text AS base_nome,
              ''::text AS base_codigo,
              ''::text AS base_uf,
              ca.valor_unitario::numeric AS custo,
              0::numeric AS frete,
              'CIF'::text AS forma_entrega,
              ca.data_cotacao::timestamp AS data_referencia,
              1::integer AS prioridade,  -- Prioridade 1 para ARLA também
              ca.valor_unitario::numeric AS custo_total  -- ARLA sempre CIF, então custo_total = custo
            FROM cotacao.cotacao_arla ca
            WHERE ca.id_empresa::bigint = v_id_empresa
              AND DATE(ca.data_cotacao) = v_latest_date
              AND UPPER(p_produto) LIKE '%ARLA%'
          )
          SELECT 
            c.base_id, c.base_nome, c.base_codigo, c.base_uf, c.custo,
            c.frete,  -- Retornar frete diretamente (já calculado corretamente na CTE e filtrado pelo WHERE)
            c.custo_total,
            c.forma_entrega, c.data_referencia
          FROM cotacoes c
          WHERE (UPPER(TRIM(c.forma_entrega)) = 'CIF' OR (UPPER(TRIM(c.forma_entrega)) = 'FOB' AND c.frete > 0))  -- Garantir que FOB só aparece com frete > 0
          ORDER BY c.custo_total ASC, c.prioridade ASC  -- Ordenar por custo_total primeiro, depois por prioridade
          LIMIT 1;
        END IF;
      END IF;
  END IF;

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

