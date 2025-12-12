import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

const mcpEnvPath = path.resolve('auro-rag-mcp', '.env');
const rootEnvPath = path.resolve('.env');

if (fs.existsSync(mcpEnvPath)) dotenv.config({ path: mcpEnvPath });
if (fs.existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const parseKey = process.env.PARSE_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchFromParse(url) {
    console.log(`[Parse] Fetching: ${url}`);
    const endpoint = 'https://api.parse.bot/scraper/98f4861a-6e6b-41ed-8efe-f9ff96ee8fe8/fetch_listing_page';
    try {
        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': parseKey },
            body: JSON.stringify({ page_url: url })
        });
        if (!resp.ok) { console.log('Error', resp.status); return null; }
        const data = await resp.json();
        // Prefer raw JSON string for RAG to parse structure
        return JSON.stringify(data, null, 2);
    } catch (e) { console.log(e); return null; }
}

async function main() {
    console.log('--- AGGRESSIVE REFRESH (LATEST ITEM) ---');
    console.log('Ensuring latest added source has content...');

    const { data: items } = await supabase.from('knowledge_base')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (items && items.length > 0) {
        const item = items[0];
        console.log(`Latest Item: ${item.source_name} (${item.id})`);
        console.log(`Current Len: ${item.content ? item.content.length : 0}`);

        let url = item.metadata?.source_url;
        // Fallback if metadata is missing but name looks like Provident
        if (!url && item.source_name.includes('Provident')) {
            console.log('URL missing in metadata. Using properties-for-sale fallback URL.');
            url = 'https://www.providentestate.com/buy/properties-for-sale/';
        }

        if (url) {
            // Force refresh if content is empty
            if (!item.content || item.content.length < 500) {
                console.log('Content is empty/short. Fetching from Parse...');
                const newContent = await fetchFromParse(url);

                if (newContent && newContent.length > 500) {
                    console.log(`Fetched ${newContent.length} chars. Updating DB...`);
                    await supabase.from('knowledge_base')
                        .update({ content: newContent, embedding: null }) // Reset embedding to trigger re-process
                        .eq('id', item.id);
                    console.log('Success. Database updated.');
                } else {
                    console.log('Fetch failed or short content returned from Parse.');
                }
            } else {
                console.log('Content already exists and looks valid. No action needed.');
            }
        } else {
            console.log('No URL found to refresh with.');
        }
    } else {
        console.log('No items found in knowledge_base.');
    }
}
main();
