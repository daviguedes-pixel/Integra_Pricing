-- =========================================================================================
-- QUERY 1: VISÃO DE MERCADO GERAL (SPOT + BANDEIRAS) POR UF
-- Objetivo: Listar MENORES PREÇOS de todas as Distribuidoras (Spot e Bandeiradas) por UF.
-- Agrupamento: UF Destino + Base Origem. (Sem NULL e Município removido)
-- =========================================================================================

WITH params AS (
    SELECT CURRENT_DATE as data_ref
),
product_classifier AS (
    SELECT * FROM (VALUES 
        ('ET', ARRAY['%ETANOL%', '%ETANOL%COMUM%', '%ETANOL%ADITIVADO%', '%EC%', '%EA%']),
        ('GC', ARRAY['%GASOLINA%COMUM%', '%GASOLINA C%', '%GC%', '%GASOLINA%TIPO%C%']),
        ('GA', ARRAY['%GASOLINA%ADITIVADA%', '%GASOLINA A%', '%GA%', '%GASOLINA%PREMIUM%']),
        ('S10', ARRAY['%DIESEL%S10%', '%S10%']),
        ('S500', ARRAY['%DIESEL%S500%', '%S500%', '%OLEO%DIESEL%B%S500%'])
    ) AS t(categoria, wildcards)
),
market_data AS (
    -- A. PREÇOS SPOT (COTACAO GERAL)
    SELECT 
        COALESCE(se.uf, '--') as uf_destino,
        COALESCE(bf.nome, '--') as base_origem,
        COALESCE(bf.uf, '--') as uf_origem,
        COALESCE(gf.nome, 'MERCADO SPOT') as distribuidora,
        pc.categoria as produto_cat,
        (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) as fob_price
    FROM cotacao.sis_empresa se
    JOIN cotacao.frete_empresa fe ON fe.id_empresa = se.id_empresa
    JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = fe.id_base_fornecedor
    LEFT JOIN cotacao.grupo_fornecedor gf ON gf.id_grupo_fornecedor = bf.id_grupo_fornecedor
    JOIN cotacao.cotacao_geral_combustivel cg ON cg.id_base_fornecedor = bf.id_base_fornecedor
    JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item = gci.id_grupo_codigo_item
    JOIN product_classifier pc ON gci.nome ILIKE ANY(pc.wildcards)
    CROSS JOIN params pa
    WHERE fe.registro_ativo = true
      AND DATE(cg.data_cotacao) = pa.data_ref
      AND UPPER(TRIM(cg.forma_entrega)) = 'FOB'

    UNION ALL

    -- B. PREÇOS BANDEIRADOS
    SELECT 
        COALESCE(se.uf, '--') as uf_destino,
        COALESCE(bf.nome, '--') as base_origem,
        COALESCE(bf.uf, '--') as uf_origem,
        COALESCE(se.bandeira, 'OUTROS') as distribuidora,
        pc.categoria as produto_cat,
        (cc.valor_unitario - COALESCE(cc.desconto_valor, 0)) as fob_price
    FROM cotacao.sis_empresa se
    JOIN cotacao.frete_empresa fe ON fe.id_empresa = se.id_empresa
    JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = fe.id_base_fornecedor
    JOIN cotacao.cotacao_combustivel cc ON cc.id_empresa = se.id_empresa AND cc.id_base_fornecedor = bf.id_base_fornecedor
    JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item = gci.id_grupo_codigo_item
    JOIN product_classifier pc ON gci.nome ILIKE ANY(pc.wildcards)
    CROSS JOIN params pa
    WHERE fe.registro_ativo = true
      AND DATE(cc.data_cotacao) = pa.data_ref
      AND UPPER(TRIM(cc.forma_entrega)) = 'FOB'
      AND NOT (se.bandeira IS NULL OR TRIM(se.bandeira) = '' OR UPPER(TRIM(se.bandeira)) LIKE '%BRANCA%')
)
SELECT 
    uf_destino as "UF Destino",
    base_origem as "Base Origem",
    uf_origem as "UF Origem",
    distribuidora as "Distribuidora",
    -- PIVOT: Menor Preço (Sem NULL, usando '-')
    COALESCE(MIN(CASE WHEN produto_cat = 'ET' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Etanol",
    COALESCE(MIN(CASE WHEN produto_cat = 'GC' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Gasolina C",
    COALESCE(MIN(CASE WHEN produto_cat = 'GA' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Gasolina Adit",
    COALESCE(MIN(CASE WHEN produto_cat = 'S10' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Diesel S10",
    COALESCE(MIN(CASE WHEN produto_cat = 'S500' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Diesel S500"
FROM market_data
GROUP BY uf_destino, base_origem, uf_origem, distribuidora
ORDER BY uf_destino, MIN(CASE WHEN produto_cat = 'GC' THEN fob_price END) ASC;


-- =========================================================================================
-- QUERY 2: VISÃO POR EMPRESA (BANDEIRA BRANCA EXPANDIDA + BANDEIRAS ESPECÍFICAS)
-- =========================================================================================

WITH params AS (
    SELECT CURRENT_DATE as data_ref
),
product_classifier AS (
    SELECT * FROM (VALUES 
        ('ET', ARRAY['%ETANOL%', '%ETANOL%COMUM%', '%ETANOL%ADITIVADO%', '%EC%', '%EA%']),
        ('GC', ARRAY['%GASOLINA%COMUM%', '%GASOLINA C%', '%GC%', '%GASOLINA%TIPO%C%']),
        ('GA', ARRAY['%GASOLINA%ADITIVADA%', '%GASOLINA A%', '%GA%', '%GASOLINA%PREMIUM%']),
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
),
company_prices AS (
    -- A. BANDEIRA BRANCA: Spot
    SELECT DISTINCT
        ac.id_empresa,
        COALESCE(bf.nome, '--') as base_origem,
        COALESCE(bf.uf, '--') as uf_origem,
        COALESCE(gf.nome, 'MERCADO SPOT') as distribuidora_nome,
        pc.categoria as produto_cat,
        (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) as fob_price
    FROM all_companies ac
    CROSS JOIN params pa
    JOIN cotacao.base_fornecedor bf ON bf.uf = ac.uf_posto 
    JOIN cotacao.cotacao_geral_combustivel cg ON cg.id_base_fornecedor = bf.id_base_fornecedor
    LEFT JOIN cotacao.grupo_fornecedor gf ON gf.id_grupo_fornecedor = bf.id_grupo_fornecedor
    JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item = gci.id_grupo_codigo_item
    JOIN product_classifier pc ON gci.nome ILIKE ANY(pc.wildcards)
    WHERE ac.is_bandeira_branca = TRUE
      AND DATE(cg.data_cotacao) = pa.data_ref
      AND UPPER(TRIM(cg.forma_entrega)) = 'FOB'

    UNION ALL

    -- B. BANDEIRADO: Contrato
    SELECT DISTINCT
        ac.id_empresa,
        COALESCE(bf.nome, '--') as base_origem,
        COALESCE(bf.uf, '--') as uf_origem,
        COALESCE(ac.bandeira, 'CONTRATO') as distribuidora_nome,
        pc.categoria as produto_cat,
        (cc.valor_unitario - COALESCE(cc.desconto_valor, 0)) as fob_price
    FROM all_companies ac
    CROSS JOIN params pa
    JOIN cotacao.cotacao_combustivel cc ON cc.id_empresa = ac.id_empresa
    JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = cc.id_base_fornecedor
    JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item = gci.id_grupo_codigo_item
    JOIN product_classifier pc ON gci.nome ILIKE ANY(pc.wildcards)
    WHERE ac.is_bandeira_branca = FALSE
      AND DATE(cc.data_cotacao) = pa.data_ref
      AND UPPER(TRIM(cc.forma_entrega)) = 'FOB'
)
SELECT 
    ac.nome_empresa as "Empresa",
    ac.bandeira as "Bandeira",
    ac.uf_posto as "UF Posto",
    ac.municipio_posto as "Município Posto",
    cp.base_origem as "Base Origem",
    cp.uf_origem as "UF Origem",
    cp.distribuidora_nome as "Distribuidora",
    COALESCE(MAX(CASE WHEN produto_cat = 'ET' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Etanol",
    COALESCE(MAX(CASE WHEN produto_cat = 'GC' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Gasolina C",
    COALESCE(MAX(CASE WHEN produto_cat = 'GA' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Gasolina Adit",
    COALESCE(MAX(CASE WHEN produto_cat = 'S10' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Diesel S10",
    COALESCE(MAX(CASE WHEN produto_cat = 'S500' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Diesel S500"
FROM all_companies ac
JOIN company_prices cp ON cp.id_empresa = ac.id_empresa
GROUP BY ac.nome_empresa, ac.bandeira, ac.uf_posto, ac.municipio_posto, cp.base_origem, cp.uf_origem, cp.distribuidora_nome
ORDER BY ac.nome_empresa, MIN(CASE WHEN produto_cat = 'GC' THEN fob_price END) ASC;
