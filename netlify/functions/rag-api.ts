import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to chunk text
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): Array<{ text: string, index: number, start: number, end: number }> {
    const chunks = [];
    let start = 0;
    let index = 0;

    while (start < text.length) {
        let end = Math.min(start + chunkSize, text.length);

        // Try to break at sentence boundary
        if (end < text.length) {
            const breakPoint = text.lastIndexOf('. ', end);
            if (breakPoint > start + chunkSize / 2) {
                end = breakPoint + 1;
            }
        }

        const chunkText = text.substring(start, end).trim();
        if (chunkText.length > 0) {
            chunks.push({
                text: chunkText,
                index: index++,
                start,
                end
            });
        }

        start = end - overlap;
        if (start >= text.length) break;
    }
    return chunks;
}

// Helper to embed and store
async function embedAndStore(
    content: string,
    filename: string,
    type: string,
    clientId: string,
    folderId: string,
    metadata: any = {}
) {
    console.log(`[RAG] Processing ${filename} for client=${clientId}, folder=${folderId}`);
    console.log(`[RAG] Content length: ${content.length} chars`);

    // 1. Create Document Record in knowledge_base (for UI listing)
    const { data: docData, error: docError } = await supabase
        .from('knowledge_base')
        .insert({
            project_id: folderId,
            type,
            source_name: filename,
            content: content.substring(0, 1000),
            metadata: { ...metadata, client_id: clientId },
            relevance_score: 1.0
        })
        .select()
        .single();

    if (docError) {
        console.error('[RAG] Failed to create knowledge_base record:', docError);
    }

    const documentId = docData?.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[RAG] Document ID: ${documentId}`);

    // 2. Generate Embeddings and Store in rag_chunks
    // Skip if SKIP_EMBEDDINGS is set
    if (process.env.SKIP_EMBEDDINGS === 'true') {
        console.log('[RAG] Skipping embeddings (SKIP_EMBEDDINGS=true)');
        return { success: true, documentId, chunksCreated: 0 };
    }

    try {
        const chunks = chunkText(content);
        console.log(`[RAG] Chunked into ${chunks.length} parts`);

        let totalChunksCreated = 0;
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        if (!GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY not configured');
        }

        // Process in small batches
        const BATCH_SIZE = 3;
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);
            const vectorRows: any[] = [];

            console.log(`[RAG] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}...`);

            for (const chunk of batch) {
                try {
                    console.log(`[RAG] Generating embedding for chunk ${chunk.index}...`);

                    // Use direct REST API instead of SDK
                    const response = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                content: { parts: [{ text: chunk.text }] }
                            })
                        }
                    );

                    if (!response.ok) {
                        const errText = await response.text();
                        throw new Error(`Gemini API error: ${response.status} - ${errText}`);
                    }

                    const result = await response.json();
                    const embedding = result.embedding?.values;

                    vectorRows.push({
                        chunk_id: `${clientId}:${folderId}:${documentId}:${chunk.index}`,
                        client_id: clientId,
                        folder_id: folderId,
                        document_id: String(documentId),
                        content: chunk.text,
                        embedding: embedding,
                        metadata: {
                            ...metadata,
                            filename,
                            type,
                            chunk_index: chunk.index,
                            chunk_total: chunks.length,
                            indexed_at: new Date().toISOString()
                        }
                    });
                } catch (embedError: any) {
                    console.error(`[RAG] Failed to embed chunk ${chunk.index}:`, embedError.message);
                }
            }

            // Upsert to rag_chunks
            if (vectorRows.length > 0) {
                console.log(`[RAG] Upserting ${vectorRows.length} chunks...`);
                const { error: upsertError } = await supabase
                    .from('rag_chunks')
                    .upsert(vectorRows, { onConflict: 'chunk_id' });

                if (upsertError) {
                    console.error('[RAG] Upsert error:', JSON.stringify(upsertError));
                } else {
                    totalChunksCreated += vectorRows.length;
                    console.log(`[RAG] Upserted ${vectorRows.length} chunks successfully`);
                }
            }
        }

        console.log(`[RAG] Successfully indexed ${totalChunksCreated} chunks total`);
        return { success: true, documentId, chunksCreated: totalChunksCreated };

    } catch (error: any) {
        console.error('[RAG] Embedding/Storage error:', error.message);
        throw error;
    }
}

export const handler: Handler = async (event, context) => {
    // Path format: /api/v1/client/:clientId/rag/:action
    const pathSegments = event.path.split('/');
    const clientId = pathSegments[4];
    const action = pathSegments[6];

    if (!clientId || !action) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid path format' }) };
    }

    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // 1. Upload Text
        if (action === 'upload_text') {
            const { text, filename, project_id } = JSON.parse(event.body || '{}');
            const folderId = project_id || 'default';

            if (!text || !filename) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing text or filename' }) };
            }

            await embedAndStore(text, filename, 'file', clientId, folderId);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: 'Text indexed successfully' })
            };
        }

        // 2. Add URL
        if (action === 'add_url') {
            const { url, project_id } = JSON.parse(event.body || '{}');
            const folderId = project_id || 'default';

            if (!url) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing URL' }) };
            }

            console.log(`[RAG] Fetching URL: ${url}`);
            const response = await fetch(url);
            const html = await response.text();
            const $ = cheerio.load(html);

            // Clean HTML
            $('script').remove();
            $('style').remove();
            $('nav').remove();
            $('footer').remove();
            const text = $('body').text().replace(/\s+/g, ' ').trim();
            const title = $('title').text() || url;

            console.log(`[RAG] Extracted ${text.length} chars from URL`);

            await embedAndStore(text, title, 'url', clientId, folderId, { source_url: url });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: 'URL indexed successfully' })
            };
        }

        // 3. Set Context (Hot Topic)
        if (action === 'set_context') {
            const { context, project_id } = JSON.parse(event.body || '{}');
            const folderId = project_id || 'default';

            if (!context) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing context' }) };
            }

            await embedAndStore(context, 'Hot Topic Context', 'hot_topic', clientId, folderId, { priority: 'high' });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: 'Context set successfully' })
            };
        }

        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Action not found' }) };

    } catch (error: any) {
        console.error(`[RAG] Error in ${action}:`, error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
