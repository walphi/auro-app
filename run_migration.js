
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

// Use .env.local for credentials
dotenv.config({ path: path.resolve('.env.local') });

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error('❌ No credentials found in .env.local.');
    process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
    const migrationFile = '20260116_fix_agent_sessions.sql';
    console.log(`--- Applying Migration: ${migrationFile} ---`);

    // Read the SQL file
    const sqlPath = path.resolve('sql', migrationFile);
    if (!fs.existsSync(sqlPath)) {
        console.error(`❌ Migration file not found: ${sqlPath}`);
        return;
    }
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Attempting to execute SQL via exec_sql RPC...');

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('❌ Error applying migration:', error.message);
        console.log('\n--- MANUAL ACTION REQUIRED ---');
        console.log('The "exec_sql" RPC function might not exist or permissions are restricted.');
        console.log(`Please copy the contents of "sql/${migrationFile}" and run it in the Supabase SQL Editor.`);
        console.log('URL: ', url);
    } else {
        console.log('✅ Migration applied successfully!');
    }
}

main();
