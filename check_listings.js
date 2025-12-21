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
    const { data: listings } = await supabase.from('property_listings').select('id, title').ilike('community', 'Creek Beach');
    let out = "";
    if (listings) listings.forEach(l => out += `ID: ${l.id} | Title: ${l.title}\n`);
    fs.writeFileSync('listings_out.txt', out);
}
main();
