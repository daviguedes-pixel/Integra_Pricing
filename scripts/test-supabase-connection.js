
// @ts-check
const { createClient } = require('@supabase/supabase-js');
// Para usar a conexão direta (parte B), instale o driver postgres:
// npm install pg

// Configurações fornecidas
const SUPABASE_URL = 'https://erdplcivoskszfhxqdko.supabase.co';
const SUPABASE_KEY = 'sb_publishable_QJu_LT-EXZ2uUt73cYdcHQ_4CUorZU5';
// A senha fornecida no chat. Se for senha de banco, será usada na parte B.
const DB_PASSWORD = 'INY7CEFxSXMBajtMmZQdXyb7eW5v3Fh';

// --- A. Conexão via Supabase JS Client (API) ---
// Usado para interações via API (Auth, Rest, Realtime)
async function testSupabaseClient() {
    console.log('--- Testando Conexão via Supabase JS Client ---');
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('Cliente inicializado.');

        // Tenta pegar a sessão (deve ser nula se não logado)
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        console.log('Sessão atual:', sessionData.session ? 'Ativa' : 'Nenhuma');

        // Se quiser testar login com o email (assumindo que Luis Gustavo seja o dono):
        // const email = 'luis.gustavo@email.com'; // PREENCHER
        // const { data, error } = await supabase.auth.signInWithPassword({
        //   email,
        //   password: DB_PASSWORD,
        // });
        // if (error) console.error('Erro login:', error.message);
        // else console.log('Login OK:', data.user.email);

    } catch (err) {
        console.error('Erro client:', err.message);
    }
}

// --- B. Conexão Direta via Postgres (pg) ---
// Requer: npm install pg
// A opção "ssl: { rejectUnauthorized: false }" remove a necessidade de certificado CA.
async function testDirectDBConnection() {
    console.log('\n--- Testando Conexão Direta Postgres (com SSL ignorado) ---');
    try {
        const { Pool } = require('pg');

        // Host direto do banco Supabase
        const connectionString = `postgres://postgres:${DB_PASSWORD}@db.erdplcivoskszfhxqdko.supabase.co:5432/postgres`;
        // Ou via pooler (se necessário):
        // const connectionString = `postgres://postgres:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

        const pool = new Pool({
            connectionString,
            ssl: {
                rejectUnauthorized: false, // "sem certificado"
            },
        });

        const client = await pool.connect();
        console.log('Conexão Postgres estabelecida!');
        const res = await client.query('SELECT NOW() as now');
        console.log('Hora do DB:', res.rows[0].now);
        client.release();
        await pool.end();
    } catch (err) {
        if (err.code === 'MODULE_NOT_FOUND') {
            console.error('Erro: Módulo "pg" não encontrado. Instale com "npm install pg" para testar conexão direta.');
        } else {
            console.error('Erro Postgres:', err.message);
        }
    }
}

(async () => {
    await testSupabaseClient();
    // Descomente abaixo para testar conexão direta (se tiver 'pg' instalado)
    await testDirectDBConnection();
})();
