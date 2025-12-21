import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error("Missing credentials");
    process.exit(1);
}

const supabase = createClient(url, key);

async function inspectProvidentData() {
    console.log("--- Inspecting 'Provident' in knowledge_base ---");
    const { data: kb, error: kbErr } = await supabase
        .from('knowledge_base')
        .select('id, content, source_name, embedding, project_id')
        .ilike('content', '%Provident%');

    if (kbErr) console.error("KB Error:", kbErr.message);
    else {
        console.log(`Found ${kb.length} rows in knowledge_base`);
        kb.forEach(r => {
            console.log(`ID: ${r.id} | Source: ${r.source_name} | Proj: ${r.project_id}`);
            console.log(`Content snippet: ${r.content.substring(0, 100)}...`);
            console.log(`Has Embedding: ${!!r.embedding}`);
            if (r.embedding) console.log(`Embedding Length: ${JSON.parse(JSON.stringify(r.embedding)).length}`);
            console.log("-------------------");
        });
    }

    console.log("\n--- Inspecting 'Provident' in rag_chunks ---");
    const { data: rc, error: rcErr } = await supabase
        .from('rag_chunks')
        .select('chunk_id, content, client_id, folder_id, embedding')
        .ilike('content', '%Provident%');

    if (rcErr) console.error("RC Error:", rcErr.message);
    else {
        console.log(`Found ${rc.length} rows in rag_chunks`);
        rc.forEach(r => {
            console.log(`ID: ${r.chunk_id} | Client: ${r.client_id} | Folder: ${r.folder_id}`);
            console.log(`Content snippet: ${r.content.substring(0, 100)}...`);
            console.log(`Has Embedding: ${!!r.embedding}`);
            if (r.embedding) console.log(`Embedding Length: ${JSON.parse(JSON.stringify(r.embedding)).length}`);
            console.log("-------------------");
        });
    }
}

inspectProvidentData();
