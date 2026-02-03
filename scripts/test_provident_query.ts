
import dotenv from 'dotenv';
import { generateEmbedding } from '../lib/rag/rag-utils';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function test() {
    const question = "Who founded Provident Real Estate and when?";
    console.log(`Question: ${question}`);

    const embedding = await generateEmbedding(question);
    if (!embedding) return;

    const { data, error } = await supabase.rpc('match_rag_chunks', {
        query_embedding: embedding,
        match_threshold: 0.35,
        match_count: 3,
        filter_tenant_id: 1,
        filter_folder_id: 'agency_history'
    });

    if (error) {
        console.error('RPC Error:', error);
        return;
    }

    console.log('\nRetrieved Chunks:');
    data.forEach((item: any, idx: number) => {
        console.log(`--- Chunk ${idx + 1} (Score: ${item.similarity.toFixed(4)}) ---`);
        console.log(item.content);
        console.log('Metadata:', item.metadata);
    });
}

test();
