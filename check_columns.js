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
    console.log('--- Checking Leads Table Schema ---');
    const { data, error } = await supabase.from('leads').select('*').limit(1);
    if (error) {
        console.error('Error selecting from leads:', error);
    } else if (data && data.length > 0) {
        console.log('Columns in leads table:');
        Object.keys(data[0]).forEach(col => console.log(` - ${col}`));
    } else {
        console.log('No data in leads table to check columns.');
    }
}
main();
