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
    const id = '023b2feb-48d3-4f4f-8310-d743b7c843aa';
    console.log(`Checking listing ${id}...`);
    const { data, error } = await supabase.from('property_listings').select('*').eq('id', id).single();
    if (error) {
        console.error('Error:', error);
    } else {
        fs.writeFileSync('listing_023b.json', JSON.stringify(data, null, 2));
        console.log('Written to listing_023b.json');
    }
}
main();
