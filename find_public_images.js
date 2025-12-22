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
    console.log('--- Searching for non-CloudFront images ---');
    const { data, error } = await supabase.from('property_listings').select('id, images').limit(100);
    if (error) {
        console.error('Error:', error);
        return;
    }

    let count = 0;
    data.forEach(l => {
        const images = Array.isArray(l.images) ? l.images : [];
        const first = images[0];
        const url = typeof first === 'string' ? first : first?.url;
        if (url && !url.includes('d3h330vgpwpjr8.cloudfront.net/x/')) {
            console.log(`ID: ${l.id} | URL: ${url}`);
            count++;
        }
    });
    console.log(`Found ${count} listings with non-blocked URLs (out of ${data.length} checked)`);
}
main();
