import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve('auro-rag-mcp', '.env');
const rootEnvPath = path.resolve('.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
if (fs.existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const parseKey = process.env.PARSE_API_KEY;

if (!supabaseUrl || !supabaseKey) { console.error('Missing DB creds'); process.exit(1); }
if (!parseKey) { console.error('Missing PARSE_API_KEY in .env'); process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchFromParse(url) {
    console.log(`Calling Parse for: ${url}`);
    const endpoint = 'https://api.parse.bot/scraper/98f4861a-6e6b-41ed-8efe-f9ff96ee8fe8/fetch_listing_page';

    try {
        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': parseKey
            },
            body: JSON.stringify({ page_url: url })
        });

        if (!resp.ok) {
            console.error(`Parse Error ${resp.status}:`, await resp.text());
            return null;
        }

        const data = await resp.json();
        const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        return content;
    } catch (e) {
        console.error('Parse Exception:', e.message);
        return null;
    }
}

async function main() {
    const { data: items } = await supabase.from('knowledge_base')
        .select('*')
        .ilike('source_name', '%Provident%')
        .limit(10);

    console.log(`Checking ${items ? items.length : 0} items...`);

    for (const item of items || []) {
        if (!item.content || item.content.length < 200) {
            console.log(`Refetching content for: ${item.source_name}`);
            const url = item.metadata?.source_url;

            if (!url) {
                console.log('No URL in metadata, skipping.');
                continue;
            }

            const newContent = await fetchFromParse(url);

            if (newContent && newContent.length > 200) {
                await supabase.from('knowledge_base')
                    .update({
                        content: newContent,
                        embedding: null
                    })
                    .eq('id', item.id);
                console.log('Updated content and reset embedding.');
            }
        }
    }
}
main();
