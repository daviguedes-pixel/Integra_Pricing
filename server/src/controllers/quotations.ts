import { Request, Response } from 'express';
import { query } from '../config/database.js';

// Query 1: Market View
// Query 1: Market View
const MARKET_QUERY = `
WITH params AS (
    SELECT $1::date as data_ref,
           $2::text as filter_uf_origem,
           $3::text as filter_uf_destino
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
    uf_destino as "UF Destino",
    base_origem as "Base Origem",
    uf_origem as "UF Origem",
    distribuidora as "Distribuidora",
    COALESCE(MIN(CASE WHEN produto_cat = 'ET' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Etanol",
    COALESCE(MIN(CASE WHEN produto_cat = 'GC' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Gasolina C",
    COALESCE(MIN(CASE WHEN produto_cat = 'GA' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Gasolina Adit",
    COALESCE(MIN(CASE WHEN produto_cat = 'S10' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Diesel S10",
    COALESCE(MIN(CASE WHEN produto_cat = 'S500' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Diesel S500"
FROM market_data
GROUP BY uf_destino, base_origem, uf_origem, distribuidora
ORDER BY uf_destino, MIN(CASE WHEN produto_cat = 'GC' THEN fob_price END) ASC;
`;

// Query 2: Company View
const COMPANY_QUERY = `
WITH params AS (
    SELECT $1::date as data_ref,
           $2::text as filter_uf_origem,
           $3::text as filter_uf_posto
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
    -- A. BANDEIRA BRANCA: Spot
    SELECT DISTINCT
        0 as id_empresa, -- Agregar todos
        COALESCE(bf.nome, '--') as base_origem,
        COALESCE(bf.uf, '--') as uf_origem,
        COALESCE(gf.nome, 'MERCADO SPOT') as distribuidora_nome,
        pc.categoria as produto_cat,
        (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) as fob_price,
        COALESCE(gf.nome, 'MERCADO SPOT') as nome_empresa,
        'BRANCA' as bandeira
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
      AND (pa.filter_uf_origem IS NULL OR bf.uf = pa.filter_uf_origem)
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
      AND (pa.filter_uf_origem IS NULL OR bf.uf = pa.filter_uf_origem)

    UNION ALL

    -- C. EVIDÊNCIA/BENCHMARK (SPOT MARKET)
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
    cp.nome_empresa as "Empresa",
    cp.bandeira as "Bandeira",
    CASE WHEN cp.id_empresa = 0 THEN cp.uf_origem ELSE (SELECT uf FROM cotacao.sis_empresa WHERE id_empresa = cp.id_empresa LIMIT 1) END as "UF Posto",
    CASE WHEN cp.id_empresa = 0 THEN '--' ELSE (SELECT municipio FROM cotacao.sis_empresa WHERE id_empresa = cp.id_empresa LIMIT 1) END as "Município Posto",
    cp.base_origem as "Base Origem",
    cp.uf_origem as "UF Origem",
    cp.distribuidora_nome as "Distribuidora",
    COALESCE(MAX(CASE WHEN produto_cat = 'ET' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Etanol",
    COALESCE(MAX(CASE WHEN produto_cat = 'GC' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Gasolina C",
    COALESCE(MAX(CASE WHEN produto_cat = 'GA' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Gasolina Adit",
    COALESCE(MAX(CASE WHEN produto_cat = 'S10' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Diesel S10",
    COALESCE(MAX(CASE WHEN produto_cat = 'S500' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Diesel S500"
FROM company_prices cp
GROUP BY cp.nome_empresa, cp.bandeira, cp.id_empresa, cp.base_origem, cp.uf_origem, cp.distribuidora_nome
ORDER BY cp.nome_empresa, MIN(CASE WHEN produto_cat = 'GC' THEN fob_price END) ASC;
`;

export const getMarketQuotations = async (req: Request, res: Response) => {
    try {
        const dateRef = req.query.date as string || new Date().toISOString().split('T')[0];
        const ufOrigem = (req.query.uf_origem as string) || null;
        const ufDestino = (req.query.uf_destino as string) || null;

        const result = await query(MARKET_QUERY, [dateRef, ufOrigem, ufDestino]);
        res.json(result.rows);
    } catch (error: any) {
        console.error('Error executing market query:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getCompanyQuotations = async (req: Request, res: Response) => {
    try {
        const dateRef = req.query.date as string || new Date().toISOString().split('T')[0];
        const ufOrigem = (req.query.uf_origem as string) || null;
        const ufPosto = (req.query.uf_posto as string) || null;

        const result = await query(COMPANY_QUERY, [dateRef, ufOrigem, ufPosto]);
        res.json(result.rows);
    } catch (error: any) {
        console.error('Error executing company query:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getFilterOptions = async (req: Request, res: Response) => {
    try {
        const dateRef = req.query.date as string || new Date().toISOString().split('T')[0];
        const viewMode = (req.query.view as string) || 'market';

        let queryText = '';

        if (viewMode === 'market') {
            queryText = `
                WITH params AS (SELECT $1::date as data_ref)
                SELECT DISTINCT
                    COALESCE(bf.uf, '--') || '/' || COALESCE(se.uf, '--') as praca,
                    COALESCE(bf.nome, '--') as base_origem
                FROM cotacao.sis_empresa se
                JOIN cotacao.frete_empresa fe ON fe.id_empresa::text = se.id_empresa::text
                JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor::text = fe.id_base_fornecedor::text
                JOIN cotacao.cotacao_geral_combustivel cg ON cg.id_base_fornecedor::text = bf.id_base_fornecedor::text
                CROSS JOIN params pa
                WHERE fe.registro_ativo = true
                  AND DATE(cg.data_cotacao) = pa.data_ref
                  AND UPPER(TRIM(cg.forma_entrega)) = 'FOB'
                ORDER BY praca, base_origem
            `;
        } else {
            // Company View - Unified query logic matching the main company query
            queryText = `
                WITH params AS (SELECT $1::date as data_ref),
                all_companies AS (
                    SELECT se.id_empresa, se.uf, se.bandeira,
                    CASE WHEN se.bandeira IS NULL OR TRIM(se.bandeira) = '' OR UPPER(TRIM(se.bandeira)) LIKE '%BRANCA%' THEN TRUE ELSE FALSE END as is_bandeira_branca
                    FROM cotacao.sis_empresa se
                )
                SELECT DISTINCT
                    COALESCE(bf.uf, '--') || '/' || COALESCE(ac.uf, '--') as praca,
                    COALESCE(bf.nome, '--') as base_origem
                FROM all_companies ac
                JOIN cotacao.base_fornecedor bf ON bf.uf::text = ac.uf::text
                JOIN cotacao.cotacao_geral_combustivel cg ON cg.id_base_fornecedor::text = bf.id_base_fornecedor::text
                CROSS JOIN params pa
                WHERE ac.is_bandeira_branca = TRUE AND DATE(cg.data_cotacao) = pa.data_ref
                
                UNION
                
                SELECT DISTINCT
                    COALESCE(bf.uf, '--') || '/' || COALESCE(ac.uf, '--') as praca,
                    COALESCE(bf.nome, '--') as base_origem
                FROM all_companies ac
                JOIN cotacao.cotacao_combustivel cc ON cc.id_empresa::text = ac.id_empresa::text
                JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor::text = cc.id_base_fornecedor::text
                CROSS JOIN params pa
                WHERE ac.is_bandeira_branca = FALSE AND DATE(cc.data_cotacao) = pa.data_ref
                
                ORDER BY praca, base_origem
            `;
        }

        const result = await query(queryText, [dateRef]);
        res.json(result.rows);
    } catch (error: any) {
        console.error('Error fetching filter options:', error);
        res.status(500).json({ error: error.message });
    }
};
