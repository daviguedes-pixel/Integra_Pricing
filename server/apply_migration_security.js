
// Script to apply migration using existing 'pg' and 'dotenv' packages
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from .env in server root or project root
dotenv.config({ path: path.join(__dirname, '.env') });
// Also try project root if not found
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;

// Connection string from env or hardcoded fallback (RISKY, better to rely on env)
// The user has a supabase project, usually DATABASE_URL is set.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("DATABASE_URL not found in .env files");
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false } // Required for Supabase usually
});

async function run() {
    try {
        // Read the migration file
        // Adjust path to where we saved the migration
        const migrationPath = path.join(__dirname, '../supabase/migrations/20260217_fix_security_holes.sql');
        console.log(`Reading migration from: ${migrationPath}`);

        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log("Connecting to database...");
        const client = await pool.connect();
        try {
            console.log("Applying migration...");
            await client.query(sql);
            console.log("Migration applied successfully!");
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
