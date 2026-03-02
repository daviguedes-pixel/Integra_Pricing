import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts"
import { corsHeaders } from "../shared/cors.ts"

// Database connection configuration for external Fly.dev DB
const DB_CONFIG = {
    hostname: "brapoio-dw.fly.dev",
    port: 5432,
    database: "analytics",
    user: "davi_guedes",
    password: "e7748bqweyasbbf99",
    tls: {
        enabled: true,
        caCertificates: [], // Accepting self-signed certificates
    }
}

const MARKET_QUERY = `
WITH params AS (
    SELECT $1::date as data_ref,
           $2::text as filter_uf_origem,
           $3::text as filter_uf_destino
),
product_classifier AS (
    SELECT * FROM (VALUES 
        ('ET', ARRAY['%ETANOL%', '%ETANOL%COMUM%', '%ETANOL%ADITIVADO%', '%EC%', '%EA%']),
        ('GC', ARRAY['%GASOLINA%COMUM%', '%GASOLINA C%', '%GC%', '%GASOLINA%TIPO%C%']),
        ('GA', ARRAY['%GASOLINA%ADITIVADA%', '%GASOLINA A%', '%GA%', '%GASOLINA%PREMIUM%', '%GASOLINA%ORIGINAL%ADITIVADA%', '%GASOLINA%ORIGINAL%', '%DT%CLEAN%']),
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

const COMPANY_QUERY = `
WITH params AS (
    SELECT $1::date as data_ref,
           $2::text as filter_uf_origem,
           $3::text as filter_uf_posto
),
product_classifier AS (
    SELECT * FROM (VALUES 
        ('ET', ARRAY['%ETANOL%', '%ETANOL%COMUM%', '%ETANOL%ADITIVADO%', '%EC%', '%EA%']),
        ('GC', ARRAY['%GASOLINA%COMUM%', '%GASOLINA C%', '%GC%', '%GASOLINA%TIPO%C%']),
        ('GA', ARRAY['%GASOLINA%ADITIVADA%', '%GASOLINA A%', '%GA%', '%GASOLINA%PREMIUM%', '%GASOLINA%ORIGINAL%ADITIVADA%', '%GASOLINA%ORIGINAL%', '%DT%CLEAN%']),
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
    -- A. BANDEIRA BRANCA: Spot (mostrando cada empresa individualmente)
    SELECT DISTINCT
        ac.id_empresa,
        COALESCE(bf.nome, '--') as base_origem,
        COALESCE(bf.uf, '--') as uf_origem,
        COALESCE(gf.nome, 'MERCADO SPOT') as distribuidora_nome,
        pc.categoria as produto_cat,
        (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) as fob_price,
        ac.nome_empresa,
        COALESCE(ac.bandeira, 'BRANCA') as bandeira,
        ac.uf_posto,
        ac.municipio_posto
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
        ac.bandeira,
        ac.uf_posto,
        ac.municipio_posto
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
        'SPOT' as bandeira,
        '--' as uf_posto,
        '--' as municipio_posto
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
    cp.id_empresa,
    cp.nome_empresa as "Empresa",
    cp.bandeira as "Bandeira",
    cp.uf_posto as "UF Posto",
    cp.municipio_posto as "Município Posto",
    cp.base_origem as "Base Origem",
    cp.uf_origem as "UF Origem",
    cp.distribuidora_nome as "Distribuidora",
    COALESCE(MAX(CASE WHEN produto_cat = 'ET' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Etanol",
    COALESCE(MAX(CASE WHEN produto_cat = 'GC' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Gasolina C",
    COALESCE(MAX(CASE WHEN produto_cat = 'GA' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Gasolina Adit",
    COALESCE(MAX(CASE WHEN produto_cat = 'S10' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Diesel S10",
    COALESCE(MAX(CASE WHEN produto_cat = 'S500' THEN TO_CHAR(fob_price, 'FMR$ 99.0000') END), '-') as "Preço Diesel S500"
FROM company_prices cp
GROUP BY cp.nome_empresa, cp.bandeira, cp.id_empresa, cp.base_origem, cp.uf_origem, cp.distribuidora_nome, cp.uf_posto, cp.municipio_posto
ORDER BY cp.nome_empresa, MIN(CASE WHEN produto_cat = 'GC' THEN fob_price END) ASC;
`;

const COSTS_QUERY = `
WITH sub_cfop AS(
    SELECT    cfop.*
FROM    cotacao.cfop 
    WHERE    cfop.tipo_cfop = 1 -- Comercialização
    AND    cfop.tipo_movimento_estoque = 3 -- Movimenta Valor e Quantidade
    AND    cfop.entrada_saida = 1 -- Entrada
    AND    cfop.gera_titulo_financeiro = 'S'
), sub_conhecimento_transporte AS(
    SELECT    
        cte.id_conhecimento_transporte
    , cte.id_municipio_inicio_prestacao
    , cte.id_municipio_fim_prestacao
    , cte.data_emissao
    , MAX(cte.data_emissao) OVER(PARTITION BY cte.id_municipio_inicio_prestacao, cte.id_municipio_fim_prestacao) ultima_data_emissao
    , cte.data_entrada
    , MAX(cte.data_entrada) OVER(PARTITION BY cte.id_municipio_inicio_prestacao, cte.id_municipio_fim_prestacao) ultima_data_entrada
    , cte.valor_frete
    , SUM(infct.quantidade) quantidade
    , ROUND(cte.valor_frete / SUM(infct.quantidade), 3) valor_unitario_frete
    FROM    cotacao.conhecimento_transporte cte
        INNER JOIN cotacao.sis_referencia_registro srr ON(srr.id_chave_registro_a = cte.id_conhecimento_transporte AND tipo_referencia = 'ref_0425_0414_frete')
        INNER JOIN cotacao.nota_fiscal_entrada nfct ON(nfct.id_nota_fiscal_entrada = srr.id_chave_registro_b)
        INNER JOIN cotacao.item_nfe infct ON(infct.id_nota_fiscal_entrada = nfct.id_nota_fiscal_entrada)
        INNER JOIN sub_cfop scfop ON(scfop.id_cfop = infct.id_cfop)
    GROUP BY 
        cte.id_conhecimento_transporte
    , cte.id_municipio_inicio_prestacao
    , cte.id_municipio_fim_prestacao
    , cte.valor_frete
    , cte.data_emissao
    , cte.data_entrada
)
SELECT
po.id_municipio id_municipio_origem
    , ufo.sigla sigla_uf_origem
        , ufo.nome uf_origem
            , mo.nome municipio_origem

                , pd.id_municipio id_municipio_destino
                    , ufd.sigla sigla_uf_destino
                        , ufd.nome uf_destino
                            , md.nome municipio_destino

                                , ie.id_empresa
                                , pd.cnpj_cpf cnpj_cpf
                                    , pd.nome razao_social
                                        , inf.id_fornecedor
                                        , po.cnpj_cpf cnpj_cpf_fornecedor
                                            , po.nome razao_social_fornecedor
                                                , ie.id_item
                                                , i.denominacao item
                                                    , ie.ultima_compra data_ultima_compra
                                                        , inf.ultimo_custo_bruto
                                                        , ct.id_conhecimento_transporte
                                                        , ct.ultima_data_entrada entrada_ultimo_frete
                                                            , ct.valor_frete valor_ultimo_frete
                                                                , ct.quantidade
                                                                , ct.valor_unitario_frete
FROM    cotacao.item_empresa ie
    INNER JOIN cotacao.item i ON(i.id_item = ie.id_item)
    INNER JOIN cotacao.pessoa pd ON(pd.id_pessoa = cotacao.F_OBTEM_PARAMETRO_INTEIRO('sistema.id_pessoa_empresa', ie.id_empresa, NULL, 'S'))
    INNER JOIN cotacao.municipio md ON(md.id_municipio = pd.id_municipio)
    INNER JOIN cotacao.uf ufd ON(ufd.id_uf = md.id_uf)
    INNER JOIN LATERAL(
                                                                    SELECT    
            nfe.id_fornecedor
                                                                    , infe.valor_unitario ultimo_custo_bruto
        FROM    cotacao.nota_fiscal_entrada nfe
            INNER JOIN cotacao.item_nfe infe ON(infe.id_nota_fiscal_entrada = nfe.id_nota_fiscal_entrada)
            INNER JOIN sub_cfop scfop ON(scfop.id_cfop = infe.id_cfop)
        WHERE    nfe.entrada = ie.ultima_compra 
        AND    nfe.id_empresa = ie.id_empresa 
        AND    infe.id_item = ie.id_item 
        ORDER BY 
            infe.id_item_nfe DESC
        LIMIT 1
                                                                ) inf ON(TRUE)
    INNER JOIN cotacao.pessoa po ON(po.id_pessoa = inf.id_fornecedor)
    INNER JOIN cotacao.municipio mo ON(mo.id_municipio = po.id_municipio)
    INNER JOIN cotacao.uf ufo ON(ufo.id_uf = mo.id_uf)
    LEFT JOIN LATERAL(
                                                                    SELECT    
            scte.id_conhecimento_transporte
                                                                    , scte.ultima_data_entrada
                                                                    , scte.valor_frete
                                                                    , scte.quantidade
                                                                    , scte.valor_unitario_frete
        FROM    sub_conhecimento_transporte scte
        WHERE    scte.data_entrada = scte.ultima_data_entrada
        AND    scte.id_municipio_inicio_prestacao = po.id_municipio 
        AND    scte.id_municipio_fim_prestacao = pd.id_municipio 
        ORDER BY 
            scte.data_entrada DESC
        LIMIT 1
                                                                ) ct ON(TRUE)
WHERE    ie.ultima_compra BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE
AND    EXISTS(
                                                                    SELECT    1 
    FROM    cotacao.lmc 
    WHERE    lmc.id_empresa = ie.id_empresa
    AND    lmc.id_combustivel = ie.id_item
                                                                )
ORDER BY
ufo.sigla
    , ufo.nome
    , mo.nome
    , ufd.sigla
    , ufd.nome
    , md.nome
    , pd.nome
        `;

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const url = new URL(req.url)
        const action = url.searchParams.get('action') || 'market'
        const dateRef = url.searchParams.get('date') || new Date().toISOString().split('T')[0]
        const ufOrigem = url.searchParams.get('uf_origem') || null
        const ufDestino = url.searchParams.get('uf_destino') || null
        const ufPosto = url.searchParams.get('uf_posto') || null

        const client = new Client(DB_CONFIG)
        await client.connect()

        let result;
        if (action === 'market') {
            result = await client.queryObject(MARKET_QUERY, [dateRef, ufOrigem, ufDestino])
        } else if (action === 'company') {
            result = await client.queryObject(COMPANY_QUERY, [dateRef, ufOrigem, ufPosto])
        } else if (action === 'costs') {
            result = await client.queryObject(COSTS_QUERY)
        } else if (action === 'filters') {
            const view = url.searchParams.get('view') || 'market'
            let filterQuery = '';
            if (view === 'market') {
                filterQuery = `
          WITH params AS(SELECT $1::date as data_ref)
          SELECT DISTINCT praca, base_origem FROM (
            -- Spot (cotacao_geral)
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

            UNION

            -- Bandeirados (cotacao_combustivel)
            SELECT DISTINCT
              COALESCE(bf.uf, '--') || '/' || COALESCE(se.uf, '--') as praca,
              COALESCE(bf.nome, '--') as base_origem
            FROM cotacao.sis_empresa se
            JOIN cotacao.frete_empresa fe ON fe.id_empresa::text = se.id_empresa::text
            JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor::text = fe.id_base_fornecedor::text
            JOIN cotacao.cotacao_combustivel cc ON cc.id_empresa::text = se.id_empresa::text AND cc.id_base_fornecedor::text = bf.id_base_fornecedor::text
            CROSS JOIN params pa
            WHERE fe.registro_ativo = true
              AND DATE(cc.data_cotacao) = pa.data_ref
              AND UPPER(TRIM(cc.forma_entrega)) = 'FOB'
              AND NOT (se.bandeira IS NULL OR TRIM(se.bandeira) = '' OR UPPER(TRIM(se.bandeira)) LIKE '%BRANCA%')
          ) sub
          ORDER BY praca, base_origem
    `;
            } else {
                filterQuery = `
          WITH params AS(SELECT $1:: date as data_ref),
    all_companies AS(
        SELECT se.id_empresa, se.uf, se.bandeira,
        CASE WHEN se.bandeira IS NULL OR TRIM(se.bandeira) = '' OR UPPER(TRIM(se.bandeira)) LIKE '%BRANCA%' THEN TRUE ELSE FALSE END as is_bandeira_branca
              FROM cotacao.sis_empresa se
    )
          SELECT DISTINCT
COALESCE(bf.uf, '--') || '/' || COALESCE(ac.uf, '--') as praca,
    COALESCE(bf.nome, '--') as base_origem
          FROM all_companies ac
          JOIN cotacao.base_fornecedor bf ON bf.uf:: text = ac.uf:: text
          JOIN cotacao.cotacao_geral_combustivel cg ON cg.id_base_fornecedor:: text = bf.id_base_fornecedor:: text
          CROSS JOIN params pa
          WHERE ac.is_bandeira_branca = TRUE AND DATE(cg.data_cotacao) = pa.data_ref

UNION
          
          SELECT DISTINCT
COALESCE(bf.uf, '--') || '/' || COALESCE(ac.uf, '--') as praca,
    COALESCE(bf.nome, '--') as base_origem
          FROM all_companies ac
          JOIN cotacao.cotacao_combustivel cc ON cc.id_empresa:: text = ac.id_empresa:: text
          JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor:: text = cc.id_base_fornecedor:: text
          CROSS JOIN params pa
          WHERE ac.is_bandeira_branca = FALSE AND DATE(cc.data_cotacao) = pa.data_ref
          
          ORDER BY praca, base_origem
    `;
            }
            result = await client.queryObject(filterQuery, [dateRef])
        } else if (action === 'previous_prices') {
            // Busca o último preço antes da data selecionada para cada distribuidora/base/produto
            const prevQuery = `
            WITH params AS (
                SELECT $1::date as data_ref
            ),
            product_classifier AS (
                SELECT * FROM (VALUES 
                    ('ET', ARRAY['%ETANOL%', '%ETANOL%COMUM%', '%ETANOL%ADITIVADO%', '%EC%', '%EA%']),
                    ('GC', ARRAY['%GASOLINA%COMUM%', '%GASOLINA C%', '%GC%', '%GASOLINA%TIPO%C%']),
                    ('GA', ARRAY['%GASOLINA%ADITIVADA%', '%GASOLINA A%', '%GA%', '%GASOLINA%PREMIUM%', '%GASOLINA%ORIGINAL%ADITIVADA%', '%GASOLINA%ORIGINAL%', '%DT%CLEAN%']),
                    ('S10', ARRAY['%DIESEL%S10%', '%S10%']),
                    ('S500', ARRAY['%DIESEL%S500%', '%S500%', '%OLEO%DIESEL%B%S500%'])
                ) AS t(categoria, wildcards)
            ),
            all_prev AS (
                -- Spot
                SELECT 
                    COALESCE(bf.nome, '--') as base_origem,
                    COALESCE(bf.uf, '--') as uf_origem,
                    COALESCE(gf.nome, 'MERCADO SPOT') as distribuidora,
                    pc.categoria as produto_cat,
                    (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) as fob_price,
                    DATE(cg.data_cotacao) as data_cotacao,
                    ROW_NUMBER() OVER (
                        PARTITION BY bf.nome, bf.uf, COALESCE(gf.nome, 'MERCADO SPOT'), pc.categoria
                        ORDER BY cg.data_cotacao DESC
                    ) as rn
                FROM cotacao.base_fornecedor bf
                LEFT JOIN cotacao.grupo_fornecedor gf ON gf.id_grupo_fornecedor::text = bf.id_grupo_fornecedor::text
                JOIN cotacao.cotacao_geral_combustivel cg ON cg.id_base_fornecedor::text = bf.id_base_fornecedor::text
                JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item::text = gci.id_grupo_codigo_item::text
                JOIN product_classifier pc ON gci.nome ILIKE ANY(pc.wildcards)
                CROSS JOIN params pa
                WHERE DATE(cg.data_cotacao) < pa.data_ref
                  AND UPPER(TRIM(cg.forma_entrega)) = 'FOB'

                UNION ALL

                -- Bandeirados
                SELECT 
                    COALESCE(bf.nome, '--') as base_origem,
                    COALESCE(bf.uf, '--') as uf_origem,
                    COALESCE(se.bandeira, 'OUTROS') as distribuidora,
                    pc.categoria as produto_cat,
                    (cc.valor_unitario - COALESCE(cc.desconto_valor, 0)) as fob_price,
                    DATE(cc.data_cotacao) as data_cotacao,
                    ROW_NUMBER() OVER (
                        PARTITION BY bf.nome, bf.uf, COALESCE(se.bandeira, 'OUTROS'), pc.categoria
                        ORDER BY cc.data_cotacao DESC
                    ) as rn
                FROM cotacao.sis_empresa se
                JOIN cotacao.frete_empresa fe ON fe.id_empresa::text = se.id_empresa::text
                JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor::text = fe.id_base_fornecedor::text
                JOIN cotacao.cotacao_combustivel cc ON cc.id_empresa::text = se.id_empresa::text AND cc.id_base_fornecedor::text = bf.id_base_fornecedor::text
                JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item::text = gci.id_grupo_codigo_item::text
                JOIN product_classifier pc ON gci.nome ILIKE ANY(pc.wildcards)
                CROSS JOIN params pa
                WHERE fe.registro_ativo = true
                  AND DATE(cc.data_cotacao) < pa.data_ref
                  AND UPPER(TRIM(cc.forma_entrega)) = 'FOB'
                  AND NOT (se.bandeira IS NULL OR TRIM(se.bandeira) = '' OR UPPER(TRIM(se.bandeira)) LIKE '%BRANCA%')
            )
            SELECT 
                base_origem as "Base Origem",
                uf_origem as "UF Origem",
                distribuidora as "Distribuidora",
                produto_cat as "Produto",
                TO_CHAR(fob_price, 'FMR$ 99.0000') as "Preco",
                fob_price as "Valor",
                data_cotacao as "Data"
            FROM all_prev
            WHERE rn = 1
            ORDER BY distribuidora, base_origem, produto_cat
            `;
            result = await client.queryObject(prevQuery, [dateRef])
        }

        await client.end()

        return new Response(
            JSON.stringify(result?.rows || [], (_, value) =>
                typeof value === 'bigint' ? value.toString() : value
            ),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )
    } catch (error: any) {
        console.error('Quotations API error:', error)
        return new Response(
            JSON.stringify({
                error: error?.message || 'Unknown error',
                details: error?.toString() || '',
                stack: error?.stack || ''
            }, (_, value) =>
                typeof value === 'bigint' ? value.toString() : value
            ),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
            }
        )
    }
})
