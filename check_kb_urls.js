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
    console.log('--- Checking Knowledge Base for images ---');
    const { data, error } = await supabase.from('knowledge_base').select('content').ilike('content', '%http%').limit(10);
    if (error) {
        console.error('Error:', error);
    } else {
        data.forEach((r, i) => {
            const matches = r.content.match(/https?:\/\/[^\s"'<>]+/g);
            if (matches) {
                console.log(`--- Result ${i + 1} ---`);
                matches.forEach(m => console.log(m));
            }
        });
    }
}
main();
