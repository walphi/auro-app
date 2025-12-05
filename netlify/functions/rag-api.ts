import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to chunk text
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): Array<{ text: string, index: number }> {
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

        const chunk = text.substring(start, end).trim();
        if (chunk.length > 0) {
            chunks.push({ text: chunk, index: index++ });
        }

        start = end - overlap;
        if (start >= text.length) break;
    }
    return chunks;
}

// Generate embedding via Gemini REST API with timeout
async function generateEmbedding(text: string, timeoutMs: number = 8000): Promise<number[] | null> {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        console.error('[RAG] GEMINI_API_KEY not set');
        return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: { parts: [{ text: text.substring(0, 4000) }] }
                }),
                signal: controller.signal
            }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`[RAG] Gemini error: ${response.status}`);
            return null;
        }

        const result = await response.json();
        return result.embedding?.values || null;
    } catch (err: any) {
        clearTimeout(timeoutId);
        console.error('[RAG] Embedding error:', err.message);
        return null;
    }
}

// Insert into knowledge_base (UI display)
async function insertKnowledgeBase(
    content: string,
    filename: string,
    type: string,
    clientId: string,
    folderId: string,
    metadata: any = {}
): Promise<string | null> {
    try {
        const { data, error } = await supabase
            .from('knowledge_base')
            .insert({
                project_id: folderId,
                type,
                source_name: filename,
                content: content.substring(0, 2000),
                metadata: { ...metadata, client_id: clientId },
                relevance_score: type === 'hot_topic' ? 10.0 : 1.0
            })
            .select('id')
            .single();

        if (error) {
            console.error('[RAG] knowledge_base error:', error.message);
            return null;
        }
        return data?.id || null;
    } catch (err: any) {
        console.error('[RAG] knowledge_base exception:', err.message);
        return null;
    }
}

// Insert chunks into rag_chunks (for RAG/MCP)
async function insertRagChunks(
    content: string,
    documentId: string,
    filename: string,
    type: string,
    clientId: string,
    folderId: string,
    metadata: any = {}
): Promise<number> {
    const chunks = chunkText(content);
    let successCount = 0;

    // Process only first 3 chunks to stay within time limit
    const chunksToProcess = chunks.slice(0, 3);

    for (const chunk of chunksToProcess) {
        try {
            const embedding = await generateEmbedding(chunk.text);

            if (!embedding) {
                console.log(`[RAG] Skipping chunk ${chunk.index} - no embedding`);
                continue;
            }

            const { error } = await supabase
                .from('rag_chunks')
                .upsert({
                    chunk_id: `${clientId}:${folderId}:${documentId}:${chunk.index}`,
                    client_id: clientId,
                    folder_id: folderId,
                    document_id: documentId,
                    content: chunk.text,
                    embedding: embedding,
                    metadata: { ...metadata, filename, type, chunk_index: chunk.index }
                }, { onConflict: 'chunk_id' });

            if (error) {
                console.error(`[RAG] rag_chunks error:`, error.message);
            } else {
                successCount++;
            }
        } catch (err: any) {
            console.error(`[RAG] chunk ${chunk.index} error:`, err.message);
        }
    }

    return successCount;
}

export const handler: Handler = async (event) => {
    const pathSegments = event.path.split('/');
    const clientId = pathSegments[4] || 'demo';
    const action = pathSegments[6];

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (!action) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing action' }) };
    }

    console.log(`[RAG] Action: ${action}, Client: ${clientId}`);

    try {
        let content = '';
        let filename = '';
        let type = '';
        let folderId = 'default';
        let metadata: any = {};

        // Parse request based on action
        if (action === 'upload_text') {
            const body = JSON.parse(event.body || '{}');
            content = body.text || '';
            filename = body.filename || 'Untitled';
            type = 'file';
            folderId = body.project_id || 'default';
        } else if (action === 'add_url') {
            const body = JSON.parse(event.body || '{}');
            const url = body.url;
            folderId = body.project_id || 'default';

            if (!url) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing URL' }) };
            }

            // Fetch URL with timeout
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 5000);

            const response = await fetch(url, {
                headers: { 'User-Agent': 'AURO-Bot/1.0' },
                signal: controller.signal
            });

            const html = await response.text();
            const $ = cheerio.load(html);
            $('script, style, nav, footer').remove();
            content = $('body').text().replace(/\s+/g, ' ').trim();
            filename = $('title').text() || url;
            type = 'url';
            metadata = { source_url: url };
        } else if (action === 'set_context') {
            const body = JSON.parse(event.body || '{}');
            content = body.context || '';
            filename = 'Hot Topic Context';
            type = 'hot_topic';
            folderId = body.project_id || 'default';
            metadata = { priority: 'high' };
        } else {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'Unknown action' }) };
        }

        if (!content) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'No content to index' }) };
        }

        console.log(`[RAG] Processing: ${filename}, ${content.length} chars`);

        // Step 1: Insert into knowledge_base (fast, for UI)
        const docId = await insertKnowledgeBase(content, filename, type, clientId, folderId, metadata);

        if (!docId) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Failed to save to knowledge base' })
            };
        }

        console.log(`[RAG] Saved to knowledge_base: ${docId}`);

        // Step 2: Try to insert into rag_chunks (may timeout, that's ok)
        // Do this in background - don't wait for completion
        const ragPromise = insertRagChunks(content, docId, filename, type, clientId, folderId, metadata);

        // Wait up to 3 seconds for RAG indexing
        const timeoutPromise = new Promise<number>(resolve => setTimeout(() => resolve(0), 3000));
        const chunksCreated = await Promise.race([ragPromise, timeoutPromise]);

        console.log(`[RAG] Complete: ${chunksCreated} chunks indexed`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Indexed successfully`,
                documentId: docId,
                chunksCreated
            })
        };

    } catch (error: any) {
        console.error(`[RAG] Error:`, error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
