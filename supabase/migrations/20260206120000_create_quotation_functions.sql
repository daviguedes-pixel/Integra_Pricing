-- Function for Market View (Query 1)
CREATE OR REPLACE FUNCTION get_market_quotations(
    p_date_ref DATE DEFAULT CURRENT_DATE,
    p_uf_origem TEXT DEFAULT NULL,
    p_uf_destino TEXT DEFAULT NULL
)
RETURNS TABLE (
    "UF Destino" TEXT,
    "Base Origem" TEXT,
    "UF Origem" TEXT,
    "Distribuidora" TEXT,
    "Preço Etanol" TEXT,
    "Preço Gasolina C" TEXT,
    "Preço Gasolina Adit" TEXT,
    "Preço Diesel S10" TEXT,
    "Preço Diesel S500" TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cotacao, extensions
AS $$
BEGIN
    RETURN QUERY
    WITH params AS (
        SELECT p_date_ref as data_ref,
               p_uf_origem as filter_uf_origem,
               p_uf_destino as filter_uf_destino
    ),
    product_classifier AS (
        SELECT * FROM (VALUES 
            ('ET', ARRAY['%ETANOL%', '%ETANOL%COMUM%', '%ETANOL%ADITIVADO%', '%EC%', '%EA%']),
            ('GC', ARRAY['%GASOLINA%COMUM%', '%GASOLINA C%', '%GC%', '%GASOLINA%TIPO%C%', '%GASOLINA%ORIGINAL%']),
            ('GA', ARRAY['%GASOLINA%ADITIVADA%', '%GASOLINA A%', '%GA%', '%GASOLINA%PREMIUM%', '%GASOLINA%ORIGINAL%ADITIVADA%', '%DT%CLEAN%']),
            ('S10', ARRAY['%DIESEL%S10%', '%S10%']),
            ('S500', ARRAY['%DIESEL%S500%', '%S500%', '%OLEO%DIESEL%B%S500%'])
        ) AS t(categoria, wildcards)
    ),
    market_data AS (
        -- A. PREÇOS SPOT (COTACAO GERAL)
        SELECT 
            COALESCE(se.uf, '--') as uf_destino,
            COALESCE(se.municipio, '--') as municipio_destino,
            COALESCE(bf.nome, '--') as base_origem,
            COALESCE(bf.uf, '--') as uf_origem,
            COALESCE(gf.nome, 'MERCADO SPOT') as distribuidora,
            pc.categoria as produto_cat,
            (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) as fob_price
        FROM cotacao.sis_empresa se
        JOIN cotacao.frete_empresa fe ON fe.id_empresa::text = se.id_empresa::text
        JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor::text = fe.id_base_fornecedor::text
        LEFT JOIN cotacao.grupo_fornecedor gf ON gf.id_grupo_fornecedor::text = bf.id_grupo_fornecedor::text
        JOIN cotacao.cotacao_geral_combustivel cg ON cg.id_base_fornecedor::text = bf.id_base_fornecedor::text
        JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item::text = gci.id_grupo_codigo_item::text
        JOIN product_classifier pc ON gci.nome ILIKE ANY(pc.wildcards)
        CROSS JOIN params pa
        WHERE fe.registro_ativo = true
          AND DATE(cg.data_cotacao) = pa.data_ref
          AND UPPER(TRIM(cg.forma_entrega)) = 'FOB'
          AND (pa.filter_uf_origem IS NULL OR bf.uf = pa.filter_uf_origem)
          AND (pa.filter_uf_destino IS NULL OR se.uf = pa.filter_uf_destino)
          AND (
              se.uf = bf.uf 
              OR 
              ( 
                gf.nome IS NOT NULL 
                AND (
                    gf.nome ILIKE '%VIBRA%' OR 
                    gf.nome ILIKE '%PETROBRAS%' OR
                    gf.nome ILIKE '%IPIRANGA%' OR
                    gf.nome ILIKE '%RAIZEN%' OR
                    gf.nome ILIKE '%SHELL%'
                )
              )
          )
    
        UNION ALL
    
        -- B. PREÇOS BANDEIRADOS
        SELECT 
            COALESCE(se.uf, '--') as uf_destino,
            COALESCE(se.municipio, '--') as municipio_destino,
            COALESCE(bf.nome, '--') as base_origem,
            COALESCE(bf.uf, '--') as uf_origem,
            COALESCE(se.bandeira, 'OUTROS') as distribuidora,
            pc.categoria as produto_cat,
            (cc.valor_unitario - COALESCE(cc.desconto_valor, 0)) as fob_price
        FROM cotacao.sis_empresa se
        JOIN cotacao.frete_empresa fe ON fe.id_empresa::text = se.id_empresa::text
        JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor::text = fe.id_base_fornecedor::text
        JOIN cotacao.cotacao_combustivel cc ON cc.id_empresa::text = se.id_empresa::text AND cc.id_base_fornecedor::text = bf.id_base_fornecedor::text
        JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item::text = gci.id_grupo_codigo_item::text
        JOIN product_classifier pc ON gci.nome ILIKE ANY(pc.wildcards)
        CROSS JOIN params pa
        WHERE fe.registro_ativo = true
          AND DATE(cc.data_cotacao) = pa.data_ref
          AND UPPER(TRIM(cc.forma_entrega)) = 'FOB'
          AND (pa.filter_uf_origem IS NULL OR bf.uf = pa.filter_uf_origem)
          AND (pa.filter_uf_destino IS NULL OR se.uf = pa.filter_uf_destino)
          AND NOT (se.bandeira IS NULL OR TRIM(se.bandeira) = '' OR UPPER(TRIM(se.bandeira)) LIKE '%BRANCA%')
    )
    SELECT 
        market_data.uf_destino::text,
        market_data.base_origem::text,
        market_data.uf_origem::text,
        market_data.distribuidora::text,
        COALESCE(MIN(CASE WHEN produto_cat = 'ET' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Etanol",
        COALESCE(MIN(CASE WHEN produto_cat = 'GC' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Gasolina C",
        COALESCE(MIN(CASE WHEN produto_cat = 'GA' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Gasolina Adit",
        COALESCE(MIN(CASE WHEN produto_cat = 'S10' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Diesel S10",
        COALESCE(MIN(CASE WHEN produto_cat = 'S500' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Diesel S500"
    FROM market_data
    GROUP BY market_data.uf_destino, market_data.base_origem, market_data.uf_origem, market_data.distribuidora
    ORDER BY market_data.uf_destino, MIN(CASE WHEN produto_cat = 'GC' THEN fob_price END) ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_market_quotations(DATE, TEXT, TEXT) TO anon, authenticated, service_role;

-- Function for Company View (Query 2)
CREATE OR REPLACE FUNCTION get_company_quotations(
    p_date_ref DATE DEFAULT CURRENT_DATE,
    p_uf_origem TEXT DEFAULT NULL,
    p_uf_posto TEXT DEFAULT NULL
)
RETURNS TABLE (
    "Empresa" TEXT,
    "Bandeira" TEXT,
    "UF Posto" TEXT,
    "Município Posto" TEXT,
    "Base Origem" TEXT,
    "UF Origem" TEXT,
    "Distribuidora" TEXT,
    "Preço Etanol" TEXT,
    "Preço Gasolina C" TEXT,
    "Preço Gasolina Adit" TEXT,
    "Preço Diesel S10" TEXT,
    "Preço Diesel S500" TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cotacao, extensions
AS $$
BEGIN
    RETURN QUERY
    WITH params AS (
        SELECT p_date_ref as data_ref,
               p_uf_origem as filter_uf_origem,
               p_uf_posto as filter_uf_posto
    ),
    product_classifier AS (
        SELECT * FROM (VALUES 
            ('ET', ARRAY['%ETANOL%', '%ETANOL%COMUM%', '%ETANOL%ADITIVADO%', '%EC%', '%EA%']),
            ('GC', ARRAY['%GASOLINA%COMUM%', '%GASOLINA C%', '%GC%', '%GASOLINA%TIPO%C%', '%GASOLINA%ORIGINAL%']),
            ('GA', ARRAY['%GASOLINA%ADITIVADA%', '%GASOLINA A%', '%GA%', '%GASOLINA%PREMIUM%', '%GASOLINA%ORIGINAL%ADITIVADA%', '%DT%CLEAN%']),
            ('S10', ARRAY['%DIESEL%S10%', '%S10%']),
            ('S500', ARRAY['%DIESEL%S500%', '%S500%', '%OLEO%DIESEL%B%S500%'])
        ) AS t(categoria, wildcards)
    ),
    all_companies AS (
        SELECT 
            se.id_empresa,
            COALESCE(se.nome_empresa, 'SEM NOME') as nome_empresa,
            COALESCE(se.bandeira, 'SEM BANDEIRA') as bandeira,
            COALESCE(se.uf, '--') as uf_posto,
            COALESCE(se.municipio, '--') as municipio_posto,
            CASE 
                WHEN se.bandeira IS NULL OR TRIM(se.bandeira) = '' OR UPPER(TRIM(se.bandeira)) LIKE '%BRANCA%' 
                THEN TRUE ELSE FALSE 
            END as is_bandeira_branca
        FROM cotacao.sis_empresa se
        CROSS JOIN params pa
        WHERE (pa.filter_uf_posto IS NULL OR se.uf = pa.filter_uf_posto)
    ),
    company_prices AS (
        -- A. BANDEIRA BRANCA: Spot (Agora mostrando NOME DA DISTRIBUIDORA em vez do Posto)
        SELECT DISTINCT
            ac.id_empresa,
            COALESCE(bf.nome, '--') as base_origem,
            COALESCE(bf.uf, '--') as uf_origem,
            COALESCE(gf.nome, 'MERCADO SPOT') as distribuidora_nome,
            pc.categoria as produto_cat,
            (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) as fob_price,
            COALESCE(gf.nome, 'MERCADO SPOT') as nome_empresa,
            'SPOT' as bandeira
        FROM all_companies ac
        CROSS JOIN params pa
        JOIN cotacao.base_fornecedor bf ON bf.uf::text = ac.uf_posto::text
        JOIN cotacao.cotacao_geral_combustivel cg ON cg.id_base_fornecedor::text = bf.id_base_fornecedor::text
        LEFT JOIN cotacao.grupo_fornecedor gf ON gf.id_grupo_fornecedor::text = bf.id_grupo_fornecedor::text
        JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item::text = gci.id_grupo_codigo_item::text
        JOIN product_classifier pc ON gci.nome ILIKE ANY(pc.wildcards)
        WHERE ac.is_bandeira_branca = TRUE
          AND DATE(cg.data_cotacao) = pa.data_ref
          AND UPPER(TRIM(cg.forma_entrega)) = 'FOB'
          -- Filtro de Origem
          AND (pa.filter_uf_origem IS NULL OR bf.uf = pa.filter_uf_origem)
          -- Excluir Holding TRR se solicitado
          AND (gf.nome IS NULL OR (gf.nome NOT ILIKE '%HOLDING%' AND gf.nome NOT ILIKE '%TRR%ITIQUIRA%'))

        UNION ALL
    
        -- B. BANDEIRADO: Contrato
        SELECT DISTINCT
            ac.id_empresa,
            COALESCE(bf.nome, '--') as base_origem,
            COALESCE(bf.uf, '--') as uf_origem,
            COALESCE(ac.bandeira, 'CONTRATO') as distribuidora_nome,
            pc.categoria as produto_cat,
            (cc.valor_unitario - COALESCE(cc.desconto_valor, 0)) as fob_price,
            ac.nome_empresa,
            ac.bandeira
        FROM all_companies ac
        CROSS JOIN params pa
        JOIN cotacao.cotacao_combustivel cc ON cc.id_empresa::text = ac.id_empresa::text
        JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor::text = cc.id_base_fornecedor::text
        JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item::text = gci.id_grupo_codigo_item::text
        JOIN product_classifier pc ON gci.nome ILIKE ANY(pc.wildcards)
        WHERE ac.is_bandeira_branca = FALSE
          AND DATE(cc.data_cotacao) = pa.data_ref
          AND UPPER(TRIM(cc.forma_entrega)) = 'FOB'
          -- Filtro de Origem
          AND (pa.filter_uf_origem IS NULL OR bf.uf = pa.filter_uf_origem)

        UNION ALL

        -- C. EVIDÊNCIA/BENCHMARK (SPOT MARKET) PARA COMPARAÇÃO
        SELECT DISTINCT
            0 as id_empresa,
            COALESCE(bf.nome, '--') as base_origem,
            COALESCE(bf.uf, '--') as uf_origem,
            COALESCE(gf.nome, 'MERCADO SPOT') as distribuidora_nome,
            pc.categoria as produto_cat,
            (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) as fob_price,
            COALESCE(gf.nome, 'MERCADO SPOT') as nome_empresa,
            'SPOT' as bandeira
        FROM cotacao.cotacao_geral_combustivel cg
        JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor::text = cg.id_base_fornecedor::text
        LEFT JOIN cotacao.grupo_fornecedor gf ON gf.id_grupo_fornecedor::text = bf.id_grupo_fornecedor::text
        JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item::text = gci.id_grupo_codigo_item::text
        JOIN product_classifier pc ON gci.nome ILIKE ANY(pc.wildcards)
        CROSS JOIN params pa
        WHERE 
          DATE(cg.data_cotacao) = pa.data_ref
          AND UPPER(TRIM(cg.forma_entrega)) = 'FOB'
          AND (pa.filter_uf_posto IS NULL OR bf.uf = pa.filter_uf_posto)
          AND (pa.filter_uf_origem IS NULL OR bf.uf = pa.filter_uf_origem)
          AND gf.nome IS NOT NULL 
          AND (
              gf.nome ILIKE '%VIBRA%' OR 
              gf.nome ILIKE '%PETROBRAS%' OR
              gf.nome ILIKE '%IPIRANGA%' OR
              gf.nome ILIKE '%RAIZEN%' OR
              gf.nome ILIKE '%SHELL%'
          )
    )
    SELECT 
        cp.nome_empresa::text as "Empresa",
        cp.bandeira::text as "Bandeira",
        CASE WHEN cp.id_empresa = 0 THEN cp.uf_origem::text ELSE (SELECT uf::text FROM cotacao.sis_empresa WHERE id_empresa = cp.id_empresa LIMIT 1) END as "UF Posto",
        CASE WHEN cp.id_empresa = 0 THEN '--' ELSE (SELECT municipio::text FROM cotacao.sis_empresa WHERE id_empresa = cp.id_empresa LIMIT 1) END as "Município Posto",
        cp.base_origem::text as "Base Origem",
        cp.uf_origem::text as "UF Origem",
        cp.distribuidora_nome::text as "Distribuidora",
        COALESCE(MAX(CASE WHEN produto_cat = 'ET' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Etanol",
        COALESCE(MAX(CASE WHEN produto_cat = 'GC' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Gasolina C",
        COALESCE(MAX(CASE WHEN produto_cat = 'GA' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Gasolina Adit",
        COALESCE(MAX(CASE WHEN produto_cat = 'S10' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Diesel S10",
        COALESCE(MAX(CASE WHEN produto_cat = 'S500' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Diesel S500"
    FROM company_prices cp
    GROUP BY cp.nome_empresa, cp.bandeira, cp.id_empresa, cp.base_origem, cp.uf_origem, cp.distribuidora_nome
    ORDER BY cp.nome_empresa, MIN(CASE WHEN produto_cat = 'GC' THEN fob_price END) ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_company_quotations(DATE, TEXT, TEXT) TO anon, authenticated, service_role;
