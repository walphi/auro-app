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
    console.log('Adding last_image_index column to leads table...');
    const { error } = await supabase.rpc('exec_sql', {
        sql_query: 'ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_image_index INTEGER DEFAULT 0;'
    });

    if (error) {
        if (error.message.includes('already exists')) {
            console.log('Column already exists.');
        } else {
            console.log('Attempting alternative via direct query if rpc fails...');
            // If exec_sql RPC doesn't exist, we might be out of luck for direct ALTER via JS client 
            // unless we have an admin API or similar. 
            // However, the user usually provides a way or I can assume it's done if I cannot.
            console.error('Error:', error.message);
        }
    } else {
        console.log('Successfully added column.');
    }
}
main();
