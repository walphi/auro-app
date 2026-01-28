import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export const handler: Handler = async (event, context) => {
    // Path format: /api/v1/client/:clientId/rag/query
    const pathSegments = event.path.split('/');
    const clientId = pathSegments[4];

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    try {
        const { query, tenant_id, project_id, folder_id, top_k = 5 } = JSON.parse(event.body || '{}');
        const targetFolderId = folder_id || project_id;

        if (!query) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing query' }) };
        }

        const finalTenantId = tenant_id || (clientId === 'demo' ? 1 : null);
        if (!finalTenantId) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing tenant_id' }) };
        }

        console.log(`[RAG Query] tenant=${finalTenantId}, folder=${targetFolderId}, query="${query}"`);

        // 1. Generate Embedding using Gemini REST API
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'GEMINI_API_KEY not configured' }) };
        }

        const embeddingResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: { parts: [{ text: query }] }
                })
            }
        );

        if (!embeddingResponse.ok) {
            const errText = await embeddingResponse.text();
            throw new Error(`Gemini API error: ${embeddingResponse.status} - ${errText}`);
        }

        const embeddingResult = await embeddingResponse.json();
        const embedding = embeddingResult.embedding?.values;

        if (!embedding) {
            throw new Error('No embedding returned from Gemini API');
        }

        console.log(`[RAG Query] Generated ${embedding.length}-dim embedding`);

        // 2. Query Supabase Vector Store (rag_chunks)
        const { data, error } = await supabase.rpc('match_rag_chunks', {
            query_embedding: embedding,
            match_threshold: 0.4,
            match_count: top_k,
            filter_tenant_id: finalTenantId,
            filter_folder_id: targetFolderId
        });

        if (error) {
            console.error('[RAG Query] Supabase RPC error:', error);
            throw error;
        }

        console.log(`[RAG Query] Found ${data?.length || 0} results`);

        // 3. Format Response
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                count: data?.length || 0,
                results: (data || []).map((item: any) => ({
                    id: item.chunk_id,
                    content: item.content,
                    score: item.similarity,
                    metadata: item.metadata,
                    source: item.metadata?.filename || item.metadata?.source_url || 'Unknown',
                    type: item.metadata?.type || 'document'
                }))
            }),
        };

    } catch (error: any) {
        console.error('[RAG Query] Error:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
