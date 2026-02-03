
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { chunkText, generateEmbedding } from '../lib/rag/rag-utils';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function simulateDashboardSync() {
    console.log('\n--- 1. Simulating Dashboard Sync (Agency Identity) ---');

    const payload = {
        tenant_id: 1,
        project_id: null,
        folder_id: 'agency_history',
        sections: [
            { title: 'Agency History & Background', content: 'Sync Test: Provident was established as a top-tier brokerage in 2008.' },
            { title: 'Awards & Recognition', content: 'Sync Test: Ranked #1 in customer satisfaction for 2025.' }
        ]
    };

    console.log('Payload:', JSON.stringify(payload, null, 2));

    const docId = `tenant_kb_${payload.tenant_id}`;

    // Clean up
    await supabase.from('knowledge_base').delete().eq('id', docId);
    await supabase.from('rag_chunks').delete().eq('document_id', docId);

    const fullContent = payload.sections.map(s => `## ${s.title}\n${s.content}`).join('\n\n');

    // Insert KB
    await supabase.from('knowledge_base').insert({
        id: docId,
        tenant_id: payload.tenant_id,
        folder_id: payload.folder_id,
        type: 'brand_story',
        content: fullContent,
        metadata: { synced_via: 'broker_dashboard' }
    });

    // Embed & Insert Chunks
    const chunks = chunkText(fullContent);
    for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk.text);
        if (embedding) {
            await supabase.from('rag_chunks').insert({
                chunk_id: `sync:${docId}:${chunk.index}`,
                tenant_id: payload.tenant_id,
                client_id: 'provident',
                folder_id: payload.folder_id,
                document_id: docId,
                content: chunk.text,
                embedding: embedding,
                metadata: { synced_via: 'broker_dashboard', is_sync: true }
            });
        }
    }
    console.log(`Synced ${chunks.length} chunks successfully.`);
}

async function testRetrievalHierarchy() {
    console.log('\n--- 2. Testing Retrieval Hierarchy (State A vs B) ---');

    // STATE A: General Query (No Project)
    console.log('\n[State A] Question: "Tell me about your history?" (No project context)');
    const embA = await generateEmbedding("Tell me about your history?");
    const { data: resultsA } = await supabase.rpc('match_rag_chunks', {
        query_embedding: embA,
        match_threshold: 0.35,
        match_count: 3,
        filter_tenant_id: 1,
        filter_project_id: null
    });

    console.log('Top Match Folder:', resultsA?.[0]?.folder_id);
    console.log('Content Snippet:', resultsA?.[0]?.content.substring(0, 50) + '...');

    // STATE B: Project Query
    const binghattiId = '225d060a-ec86-495b-a40d-872c96123467';
    console.log(`\n[State B] Question: "What are the amenities at Binghatti Skyrise?" (Project context: Binghatti Skyrise)`);
    const embB = await generateEmbedding("What are the amenities at Binghatti Skyrise?");
    const { data: resultsB } = await supabase.rpc('match_rag_chunks', {
        query_embedding: embB,
        match_threshold: 0.25,
        match_count: 3,
        filter_tenant_id: 1,
        filter_project_id: binghattiId
    });

    console.log('Top Match Folder:', resultsB?.[0]?.folder_id);
    console.log('Content Snippet:', resultsB?.[0]?.content.substring(0, 50) + '...');
}

async function main() {
    await simulateDashboardSync();
    await testRetrievalHierarchy();
}

main();
