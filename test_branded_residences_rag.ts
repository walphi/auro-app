import dotenv from 'dotenv';
import { generateEmbedding } from './lib/rag/rag-utils';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

async function testBrandedResidences() {
    const question = "What are the key points about branded residences in Dubai from our reports?";
    console.log(`\n🚀 [Test] Querying RAG system...`);
    console.log(`💬 Question: "${question}"`);

    // 1. Generate Query Embedding
    const embedding = await generateEmbedding(question);
    if (!embedding) {
        console.error('❌ Failed to generate embedding');
        return;
    }

    // 2. Retrieve Relevant Chunks
    // Note: We search across all folders for tenant 1 to be safe
    const { data: chunks, error } = await supabase.rpc('match_rag_chunks', {
        query_embedding: embedding,
        match_threshold: 0.1, // Lowered threshold for testing recall
        match_count: 15,
        filter_tenant_id: 1,
        filter_folder_id: 'market_reports',
        filter_project_id: null
    });

    if (error) {
        console.error('❌ RPC Error:', error);
        return;
    }

    console.log(`\n📚 [Retrieval] Found ${chunks?.length || 0} relevant chunks.`);

    if (!chunks || chunks.length === 0) {
        console.log('⚠️ No context found in the database. Please ensure the PDF was processed correctly.');
        return;
    }

    // Sort by similarity for context building
    const context = chunks
        .map((c: any, i: number) => `[Source: ${c.metadata?.source_name || 'Report'}] \n${c.content}`)
        .join('\n\n---\n\n');

    console.log('\n--- TOP RETRIEVED CONTENT ---');
    chunks.slice(0, 2).forEach((c: any) => {
        console.log(`[Score: ${c.similarity.toFixed(3)}] ${c.content.substring(0, 200)}...`);
    });
    console.log('-------------------------------\n');

    // 3. Generate Answer using Gemini
    console.log(`🤖 [Generation] Asking Gemini to synthesize answer...`);

    const prompt = `
    You are an AI Real Estate Assistant for Provident Estate.
    Answer the following question using ONLY the provided context from our market reports.
    If the context is insufficient, state that clearly.

    CONTEXT:
    ${context}

    QUESTION:
    ${question}

    ANSWER:`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            }
        );

        const result = await response.json();
        if (result.error) {
            console.error('❌ Gemini API Error:', JSON.stringify(result.error, null, 2));
            return;
        }
        const answer = result.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";

        console.log(`\n✨ [Final AI Response] ✨`);
        console.log(answer);
    } catch (err: any) {
        console.error('❌ Generation Error:', err.message);
    }
}

testBrandedResidences();
