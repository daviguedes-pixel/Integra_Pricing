import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts"
import { corsHeaders } from "../shared/cors.ts"

// Database connection configuration for Petros DB (Supabase Pooler)
const PETROS_DB_CONFIG = {
    hostname: "aws-0-us-west-2.pooler.supabase.com",
    port: 6543,
    database: "postgres",
    user: "davi_guedes.erdplcivoskszfhxqdko",
    password: "j*te1Y4*OWJv!Km3", // Moving to env var recommended in prod
    tls: {
        enabled: true,
        caCertificates: [], // Accepting self-signed certificates, matching quotations-api pattern
    }
}

const TANK_VALIDATION_QUERY = `
WITH compras_recentes AS (
    SELECT 
        n.id_empresa,
        se.nome AS nome_posto,
        m_posto.nome AS municipio_posto,
        u_posto.sigla AS uf_posto,
        i2.denominacao AS produto,
        p.nome AS bandeira_validada,
        p.cnpj_cpf AS cnpj_distribuidora,
        m.nome AS municipio_distribuidora,
        u.sigla AS uf_distribuidora,
        n.emissao AS data_ultima_compra,
        -- Ranking para pegar a compra mais recente de cada produto por posto
        ROW_NUMBER() OVER (
            PARTITION BY n.id_empresa, i2.denominacao 
            ORDER BY n.emissao DESC, n.id_nota_fiscal_entrada DESC
        ) AS rnk
    FROM petros.nota_fiscal_entrada n
    INNER JOIN petros.sis_empresa se ON se.id_empresa = n.id_empresa
    LEFT JOIN petros.municipio m_posto ON m_posto.id_municipio = se.id_municipio
    LEFT JOIN petros.uf u_posto ON u_posto.id_uf = m_posto.id_uf
    INNER JOIN petros.pessoa p ON p.id_pessoa = n.id_fornecedor
    LEFT JOIN petros.municipio m ON m.id_municipio = p.id_municipio
    LEFT JOIN petros.uf u ON u.id_uf = m.id_uf
    INNER JOIN petros.item_nfe i ON i.id_nota_fiscal_entrada = n.id_nota_fiscal_entrada
    INNER JOIN petros.item i2 ON i2.id_item = i.id_item
    WHERE n.id_natureza_operacao = 1
      AND i2.id_categoria_item = 1005
      -- Regra de validação: Compra nos últimos 14 dias
      AND n.emissao >= CURRENT_DATE - INTERVAL '14 days'
)
SELECT 
    id_empresa,
    nome_posto,
    municipio_posto,
    uf_posto,
    produto,
    bandeira_validada,
    cnpj_distribuidora,
    municipio_distribuidora,
    uf_distribuidora,
    data_ultima_compra,
    'VALIDADO' AS status_tanque
FROM compras_recentes
WHERE rnk = 1
ORDER BY nome_posto, produto
`;

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const client = new Client(PETROS_DB_CONFIG)
        await client.connect()

        const result = await client.queryObject(TANK_VALIDATION_QUERY)

        await client.end()

        return new Response(
            JSON.stringify(result.rows, (_, value) =>
                typeof value === 'bigint' ? value.toString() : value
            ),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )
    } catch (error) {
        console.error('Petros API error:', error)
        return new Response(
            JSON.stringify({
                error: error.message,
                details: error.toString(),
                stack: error.stack
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
