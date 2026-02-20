import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
        rejectUnauthorized: false
    }
});

// Log connection attempt (masking password)
console.log('🔌 Tentando conectar ao banco de dados:', {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    ssl: true
});

// Test connection immediately
pool.connect()
    .then(client => {
        console.log('✅ Conexão com o banco de dados estabelecida com sucesso!');
        client.release();
    })
    .catch(err => {
        console.error('❌ Erro fatal ao conectar no banco de dados:', err.message);
    });

// Test connection
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
export default pool;
