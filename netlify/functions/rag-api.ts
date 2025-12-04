import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

console.log('[RAG Init] Supabase URL:', supabaseUrl ? 'SET' : 'NOT SET');
console.log('[RAG Init] Supabase Key:', supabaseKey ? 'SET' : 'NOT SET');
console.log('[RAG Init] Gemini Key:', process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET');

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to chunk text
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): Array<{ text: string, index: number, start: number, end: number }> {
    const chunks = [];
    let start = 0;
    let index = 0;

    while (start < text.length) {
        let end = Math.min(start + chunkSize, text.length);

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

// Helper to generate embedding via Gemini REST API
async function generateEmbedding(text: string): Promise<number[] | null> {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        console.error('[RAG] GEMINI_API_KEY not configured');
        return null;
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: { parts: [{ text: text.substring(0, 5000) }] } // Limit text length
                })
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[RAG] Gemini API error: ${response.status} - ${errText}`);
            return null;
        }

        const result = await response.json();
        return result.embedding?.values || null;
    } catch (err: any) {
        console.error('[RAG] Embedding error:', err.message);
        return null;
    }
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
    let documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
        const { data: docData, error: docError } = await supabase
            .from('knowledge_base')
            .insert({
                project_id: folderId, // This must be a valid UUID from projects table
                type,
                source_name: filename,
                content: content.substring(0, 1000),
                metadata: { ...metadata, client_id: clientId },
                relevance_score: 1.0
            })
            .select()
            .single();

        if (docError) {
            console.error('[RAG] knowledge_base insert error:', JSON.stringify(docError));
            // Continue anyway - rag_chunks is the primary store
        } else if (docData) {
            documentId = docData.id;
        }
    } catch (err: any) {
        console.error('[RAG] knowledge_base exception:', err.message);
    }

    console.log(`[RAG] Document ID: ${documentId}`);

    // 2. Generate Embeddings and Store in rag_chunks
    if (process.env.SKIP_EMBEDDINGS === 'true') {
        console.log('[RAG] Skipping embeddings (SKIP_EMBEDDINGS=true)');
        return { success: true, documentId, chunksCreated: 0 };
    }

    const chunks = chunkText(content);
    console.log(`[RAG] Chunked into ${chunks.length} parts`);

    let totalChunksCreated = 0;

    // Process chunks
    for (const chunk of chunks) {
        try {
            console.log(`[RAG] Processing chunk ${chunk.index + 1}/${chunks.length}...`);

            const embedding = await generateEmbedding(chunk.text);

            if (!embedding) {
                console.error(`[RAG] Failed to generate embedding for chunk ${chunk.index}`);
                continue;
            }

            console.log(`[RAG] Embedding generated: ${embedding.length} dimensions`);

            // Insert into rag_chunks
            const { error: upsertError } = await supabase
                .from('rag_chunks')
                .upsert({
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
                }, { onConflict: 'chunk_id' });

            if (upsertError) {
                console.error('[RAG] rag_chunks upsert error:', JSON.stringify(upsertError));
            } else {
                totalChunksCreated++;
                console.log(`[RAG] Chunk ${chunk.index} upserted successfully`);
            }
        } catch (err: any) {
            console.error(`[RAG] Chunk ${chunk.index} error:`, err.message);
        }
    }

    console.log(`[RAG] Total chunks created: ${totalChunksCreated}/${chunks.length}`);
    return { success: totalChunksCreated > 0, documentId, chunksCreated: totalChunksCreated };
}

export const handler: Handler = async (event, context) => {
    // Path format: /api/v1/client/:clientId/rag/:action
    const pathSegments = event.path.split('/');
    const clientId = pathSegments[4] || 'demo';
    const action = pathSegments[6];

    console.log(`[RAG Handler] Action: ${action}, Client: ${clientId}`);

    if (!action) {
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

            const result = await embedAndStore(text, filename, 'file', clientId, folderId);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: result.success, message: `Indexed ${result.chunksCreated} chunks` })
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
            const response = await fetch(url, {
                headers: { 'User-Agent': 'AURO-Bot/1.0' }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch URL: ${response.status}`);
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            $('script').remove();
            $('style').remove();
            $('nav').remove();
            $('footer').remove();
            const text = $('body').text().replace(/\s+/g, ' ').trim();
            const title = $('title').text() || url;

            console.log(`[RAG] Extracted ${text.length} chars from URL`);

            const result = await embedAndStore(text, title, 'url', clientId, folderId, { source_url: url });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: result.success, message: `URL indexed: ${result.chunksCreated} chunks` })
            };
        }

        // 3. Set Context (Hot Topic)
        if (action === 'set_context') {
            const { context, project_id } = JSON.parse(event.body || '{}');
            const folderId = project_id || 'default';

            if (!context) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing context' }) };
            }

            const result = await embedAndStore(context, 'Hot Topic Context', 'hot_topic', clientId, folderId, { priority: 'high' });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: result.success, message: `Context set: ${result.chunksCreated} chunks` })
            };
        }

        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Action not found' }) };

    } catch (error: any) {
        console.error(`[RAG] Handler error:`, error.message, error.stack);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
