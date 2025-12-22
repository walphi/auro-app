import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve('auro-rag-mcp', '.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
else dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.log('No credentials found.'); process.exit(1); }
const supabase = createClient(url, key);

async function main() {
    console.log('--- Applying Migration: add_booking_fields_to_leads.sql ---');

    // Read the SQL file
    const sqlPath = path.resolve('sql', 'add_booking_fields_to_leads.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // We use RPC 'exec_sql' if available, otherwise we try to use the REST API (which doesn't support raw SQL easily)
    // In many Supabase setups, people create an exec_sql function.
    // If not, I'll try to just perform the ALTER TABLE via a direct query if I can, but Supabase JS doesn't support raw SQL.

    console.log('SQL to execute:');
    console.log(sql);

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('Error applying migration (Note: exec_sql RPC might not exist):', error.message);
        console.log('Please apply the SQL manually in Supabase SQL Editor if this failed.');
    } else {
        console.log('Migration applied successfully!');
    }
}
main();
