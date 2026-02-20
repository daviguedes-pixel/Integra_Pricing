
// @ts-check
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

/**
 * Script de Conexão Supabase / Postgres (IPv4)
 * Usuário: davi_guedes.erdplcivoskszfhxqdko
 */

// --- CONFIGURAÇÕES ---
const SUPABASE_URL = 'https://erdplcivoskszfhxqdko.supabase.co';
const SUPABASE_KEY = 'sb_publishable_QJu_LT-EXZ2uUt73cYdcHQ_4CUorZU5';
const DB_PASSWORD = 'j*te1Y4*OWJv!Km3';

// --- 1. CONEXÃO VIA SUPABASE CLIENT (API/AUTH) ---
async function testSupabaseClient() {
    console.log('--- Testando: Supabase JS Client ---');
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        console.log('✅ Cliente inicializado com sucesso.');
    } catch (err) {
        console.error('❌ Erro no Cliente Supabase:', err.message);
    }
}

// --- 2. CONEXÃO DIRETA VIA POSTGRES (POOLER) ---
// Nota: Conexões diretas na porta 5432 com o host 'db.*' podem falhar por timeout em algumas redes.
// O uso do Pooler (aws-0-us-west-2.pooler.supabase.com) é mais estável.
async function testPostgresConnection() {
    console.log('\n--- Testando: Conexão via Postgres Pooler ---');

    const poolConfig = {
        host: 'aws-0-us-west-2.pooler.supabase.com',
        port: 6543, // Modo Transação (mais performante para scripts)
        user: 'davi_guedes.erdplcivoskszfhxqdko',
        password: DB_PASSWORD,
        database: 'postgres',
        ssl: { rejectUnauthorized: false }, // "Sem certificado" (ignora validação CA)
    };

    console.log(`Conectando em: ${poolConfig.host}:${poolConfig.port} como ${poolConfig.user}`);

    const pool = new Pool(poolConfig);
    try {
        const client = await pool.connect();
        console.log('✅ SUCESSO! Conexão Postgres estabelecida.');

        const res = await client.query('SELECT NOW() as now, current_user, version()');
        console.log('Dados do Banco:', res.rows[0]);

        client.release();
    } catch (err) {
        console.error('❌ Erro na Conexão Postgres:', err.message);
    } finally {
        await pool.end();
    }
}

// EXECUÇÃO
(async () => {
    await testSupabaseClient();
    await testPostgresConnection();
})();
