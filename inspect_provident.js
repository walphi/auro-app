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
    console.log('--- RECENT KNOWLEDGE BASE ---');
    const { data: kb } = await supabase.from('knowledge_base')
        .select('*').order('created_at', { ascending: false }).limit(20);

    if (kb) kb.forEach(r => {
        const isTarget = JSON.stringify(r).match(/Provident/i);
        const marker = isTarget ? '*** ' : '';
        const emb = r.embedding ? 'YES' : 'NO';
        console.log(`${marker}${r.created_at} | Proj: ${r.project_id} | Src: ${r.source_name} | Emb: ${emb} | Len: ${r.content?.length}`);
    });

    console.log('\n--- RECENT LEADS ---');
    const { data: leads } = await supabase.from('leads').select('name, phone, current_listing_id, created_at').order('created_at', { ascending: false }).limit(10);
    if (leads) leads.forEach(l => console.log(`${l.created_at} | Lead: ${l.name} | Phone: ${l.phone} | Current Listing: ${l.current_listing_id}`));

    console.log('\n--- RECENT RAG CHUNKS ---');
    const { data: rc } = await supabase.from('rag_chunks')
        .select('chunk_id, created_at, client_id, folder_id').order('created_at', { ascending: false }).limit(20);

    if (rc) rc.forEach(r => {
        const isTarget = JSON.stringify(r).match(/Provident/i);
        const marker = isTarget ? '*** ' : '';
        console.log(`${marker}${r.created_at} | Folder: ${r.folder_id} | Client: ${r.client_id}`);
    });
}
main();
