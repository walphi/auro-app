
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.log('No credentials found.'); process.exit(1); }
const supabase = createClient(url, key);

async function main() {
    const table = process.argv[2] || 'knowledge_base';
    console.log(`--- Checking ${table} Table Schema ---`);
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
        console.error(`Error selecting from ${table}:`, error);
    } else if (data && data.length > 0) {
        console.log(`Columns in ${table} table:`);
        Object.keys(data[0]).forEach(col => console.log(` - ${col}`));
    } else {
        console.log(`No data in ${table} table to check columns.`);
    }
}
main();
