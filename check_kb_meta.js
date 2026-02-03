
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
    console.log('--- Checking knowledge_base Metadata ---');
    const { data, error } = await supabase.from('knowledge_base').select('metadata').limit(5);
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Sample Metadata:', JSON.stringify(data, null, 2));
    }
}
main();
