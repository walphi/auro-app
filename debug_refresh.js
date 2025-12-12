import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

// ROBUST ENV LOADING
const mcpEnvPath = path.resolve('auro-rag-mcp', '.env');
const rootEnvPath = path.resolve('.env');

console.log('--- Loading Envs ---');
if (fs.existsSync(mcpEnvPath)) {
    console.log(`Loading: ${mcpEnvPath}`);
    dotenv.config({ path: mcpEnvPath });
}
if (fs.existsSync(rootEnvPath)) {
    console.log(`Loading: ${rootEnvPath}`);
    dotenv.config({ path: rootEnvPath });
}

// Config
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const parseKey = process.env.PARSE_API_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error(`Missing DB Creds. URL=${!!supabaseUrl}, Key=${!!supabaseKey}`);
    process.exit(1);
}
if (!parseKey) {
    console.error('Missing PARSE_API_KEY');
    process.exit(1);
}

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
        if (!resp.ok) {
            console.log(`[Parse] Error ${resp.status}:`, await resp.text());
            return null;
        }
        const data = await resp.json();
        let content = data.markdown || data.text || data.content || JSON.stringify(data, null, 2);
        return content;
    } catch (e) {
        console.log(`[Parse] Exception: ${e.message}`);
        return null;
    }
}

async function main() {
    const { data: items } = await supabase.from('knowledge_base')
        .select('*')
        .ilike('source_name', '%Provident%')
        .order('created_at', { ascending: false })
        .limit(10);

    console.log(`Found ${items ? items.length : 0} items.`);

    for (const item of items || []) {
        console.log(`Checking: ${item.source_name}`);
        console.log(`- Current Len: ${item.content ? item.content.length : 0}`);

        const url = item.metadata?.source_url;
        console.log(`- URL: ${url || 'NONE'}`);

        if (!url) continue;

        // Force refresh only if short
        if (!item.content || item.content.length < 500) {
            console.log('- Refreshing content...');
            const newContent = await fetchFromParse(url);
            if (newContent && newContent.length > 200) {
                console.log(`- Success! New Len: ${newContent.length}`);

                // Update KB
                await supabase.from('knowledge_base')
                    .update({ content: newContent, embedding: null })
                    .eq('id', item.id);

                console.log('- DB Updated. Resetting MVP embeddings...');

                // Delete bad chunks to force regeneration
                await supabase.from('rag_chunks').delete().eq('document_id', item.id);
            } else {
                console.log('- Parse returned empty/short content.');
            }
        } else {
            console.log('- Content seems valid. Skipping.');
        }
        console.log('---');
    }
}
main();
