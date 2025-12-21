import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

// Try multiple paths for .env
const envPaths = ['.env', 'auro-rag-mcp/.env'];
for (const p of envPaths) {
    if (fs.existsSync(p)) {
        dotenv.config({ path: p });
        break;
    }
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(url, key);

async function checkDatabase() {
    console.log("Checking database for 'Provident' content...");

    // 1. Check knowledge_base
    const { data: kb, error: kbErr } = await supabase
        .from('knowledge_base')
        .select('count')
        .ilike('content', '%Provident%');

    // Note: count is not returned like this in default select, use count options
    const { count: kbCount, error: kbCountErr } = await supabase
        .from('knowledge_base')
        .select('*', { count: 'exact', head: true })
        .ilike('content', '%Provident%');

    console.log(`Knowledge Base entries mentioning 'Provident': ${kbCount || 0}`);

    // 2. Check rag_chunks
    const { count: rcCount, error: rcCountErr } = await supabase
        .from('rag_chunks')
        .select('*', { count: 'exact', head: true })
        .ilike('content', '%Provident%');

    console.log(`RAG Chunks mentioning 'Provident': ${rcCount || 0}`);

    // 3. Print total rows if counts are 0
    if ((kbCount || 0) === 0 && (rcCount || 0) === 0) {
        const { count: kbTotal } = await supabase.from('knowledge_base').select('*', { count: 'exact', head: true });
        const { count: rcTotal } = await supabase.from('rag_chunks').select('*', { count: 'exact', head: true });
        console.log(`Total Knowledge Base Rows: ${kbTotal || 0}`);
        console.log(`Total RAG Chunks Rows: ${rcTotal || 0}`);
    } else {
        // Print some snippets
        const { data: snippets } = await supabase
            .from('knowledge_base')
            .select('content, source_name')
            .ilike('content', '%Provident%')
            .limit(2);

        if (snippets) {
            snippets.forEach((s, i) => {
                console.log(`Snippet ${i + 1} from ${s.source_name}: ${s.content.substring(0, 100)}...`);
            });
        }
    }
}

checkDatabase();
