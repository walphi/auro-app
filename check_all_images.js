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
    const { data, error } = await supabase.from('property_listings').select('title, images, image_url_jpeg').limit(10);
    if (error) {
        console.error('Error:', error);
    } else {
        data.forEach((l, i) => {
            console.log(`--- Listing ${i + 1} ---`);
            console.log(`Title: ${l.title}`);
            console.log(`JPEG: ${l.image_url_jpeg}`);
            console.log(`First Image: ${l.images?.[0]}`);
        });
    }
}
main();
