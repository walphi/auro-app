
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log('--- Debugging RAG Chunks for Binghatti Skyrise ---');
    const { data, error } = await supabase
        .from('rag_chunks')
        .select('chunk_id, tenant_id, project_id, folder_id, content')
        .eq('project_id', '225d060a-ec86-495b-a40d-872c96123467');

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log(`Found ${data.length} chunks.`);
        data.forEach((c, i) => {
            console.log(`\n[Chunk ${i + 1}] ID: ${c.chunk_id}`);
            console.log(`Content: ${c.content.substring(0, 100)}...`);
        });
    }
}
main();
