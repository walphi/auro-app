import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { chunkText, generateEmbedding } from '../../lib/rag/rag-utils';

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export const handler: Handler = async (event) => {
    console.log(`[RAG-API] Received request. Method: ${event.httpMethod}, Path: ${event.path}`);

    const pathSegments = event.path.split('/');

    // Robust parsing: Find 'client' and 'rag' segments dynamically
    let clientId = 'demo';
    let action = '';

    const clientIdx = pathSegments.indexOf('client');
    if (clientIdx !== -1 && pathSegments[clientIdx + 1]) {
        clientId = pathSegments[clientIdx + 1];
    }

    const ragIdx = pathSegments.indexOf('rag');
    if (ragIdx !== -1 && pathSegments[ragIdx + 1]) {
        action = pathSegments[ragIdx + 1];
    } else {
        // Fallback: Check if it's a direct function call like /.netlify/functions/rag-api/action
        // In that case, the last segment might be the action? 
        // Or if we are using the query string?
        const lastSeg = pathSegments[pathSegments.length - 1];
        if (['upload_text', 'delete_source', 'add_url', 'set_context'].includes(lastSeg)) {
            action = lastSeg;
        }
    }

    // Allow override from Body (useful for testing)
    let body: any = {};
    try {
        body = JSON.parse(event.body || '{}');
    } catch (e) {
        console.error('[RAG-API] Failed to parse body:', e);
    }

    if (body.action) action = body.action;
    if (body.client_id) clientId = body.client_id;

    console.log(`[RAG-API] Resolved - Client: ${clientId}, Action: ${action}`);

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (!action) {
        console.error(`[RAG-API] Error: Missing action. Path was: ${event.path}`);
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing action', path: event.path }) };
    }

    try {
        let content = '';
        let filename = '';
        let type = '';
        let folderId = 'default';
        let metadata: any = {};

        const reqTenantId = body.tenant_id || (clientId === 'demo' ? 1 : null);
        const reqClientId = body.client_id || clientId;

        if (!reqTenantId) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing tenant_id' }) };
        }

        // Pass through metadata
        metadata = {
            ...(body.metadata || {}),
            tenant_id: reqTenantId,
            client_id: reqClientId
        };

        // Parse request based on action
        if (action === 'upload_text') {
            content = body.text || '';
            filename = body.filename || 'Untitled';
            type = 'file';
            folderId = body.folder_id || body.project_id || 'projects';
        } else if (action === 'delete_source') {
            const sourceId = body.id;
            if (!sourceId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing ID' }) };

            console.log(`[RAG] Deleting source: ${sourceId}`);
            const { error: kbErr } = await supabase.from('knowledge_base').delete().eq('id', sourceId);
            if (kbErr) {
                console.error('[RAG] Delete error:', kbErr);
                return { statusCode: 500, headers, body: JSON.stringify({ error: kbErr.message }) };
            }

            await supabase.from('rag_chunks').delete().eq('document_id', sourceId);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Deleted' }) };
        } else if (action === 'add_url') {
            const url = body.url;
            folderId = 'website';

            if (!url) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing URL' }) };
            }

            metadata.source_url = url;

            // Fetch URL with 15 second timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            try {
                console.log('[RAG] Fetching URL:', url);
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    console.error('[RAG] URL response not OK:', response.status);
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Failed to fetch URL: HTTP ${response.status}` }) };
                }

                const html = await response.text();
                console.log('[RAG] HTML received:', html.length, 'bytes');
                const $ = cheerio.load(html);

                // Try multiple extraction methods
                let extractedContent = '';

                // Method 1: Try JSON-LD structured data
                $('script[type="application/ld+json"]').each((i, el) => {
                    try {
                        const jsonLd = JSON.parse($(el).html() || '{}');
                        if (jsonLd.description) extractedContent += jsonLd.description + ' ';
                        if (jsonLd.name) extractedContent += jsonLd.name + ' ';
                        if (jsonLd.text) extractedContent += jsonLd.text + ' ';
                    } catch (e) { }
                });

                // Method 2: Meta description and OG tags
                const metaDesc = $('meta[name="description"]').attr('content') || '';
                const ogDesc = $('meta[property="og:description"]').attr('content') || '';
                const ogTitle = $('meta[property="og:title"]').attr('content') || '';
                extractedContent += `${metaDesc} ${ogDesc} ${ogTitle} `;

                // Method 3: Body text (after removing scripts)
                $('script, style, nav, footer, header, noscript, iframe').remove();
                const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
                extractedContent += bodyText;

                content = extractedContent.trim().substring(0, 10000);
                filename = $('title').text() || ogTitle || url;
                console.log('[RAG] Extracted content:', content.length, 'chars');

                // If still no content, it's likely a JavaScript SPA
                if (content.length < 50) {
                    console.error('[RAG] No content extracted - likely JavaScript SPA');

                    if (process.env.PARSE_API_KEY) {
                        console.log('[RAG] Attempting Parse Fallback...');
                        try {
                            const parseResp = await fetch('https://api.parse.bot/scraper/98f4861a-6e6b-41ed-8efe-f9ff96ee8fe8/fetch_listing_page', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.PARSE_API_KEY },
                                body: JSON.stringify({ page_url: url })
                            });

                            if (parseResp.ok) {
                                const parseData = await parseResp.json();
                                // Handle various response formats
                                const parseContent = parseData.markdown || parseData.text || parseData.content || JSON.stringify(parseData, null, 2);

                                if (parseContent && parseContent.length > 50) {
                                    console.log('[RAG] Parse Success:', parseContent.length, 'chars');
                                    content = parseContent;
                                } else {
                                    console.log('[RAG] Parse returned empty content.');
                                }
                            } else {
                                console.error('[RAG] Parse API Error:', parseResp.status);
                            }
                        } catch (parseErr: any) {
                            console.error('[RAG] Parse Exception:', parseErr.message);
                        }
                    }

                    if (content.length < 50) {
                        return {
                            statusCode: 400,
                            headers,
                            body: JSON.stringify({
                                error: 'This website uses JavaScript to render content and Parse fallback failed. Please copy and paste the text manually using "Set Context" instead.'
                            })
                        };
                    }
                }
            } catch (fetchErr: any) {
                clearTimeout(timeoutId);
                console.error('[RAG] URL fetch error:', fetchErr.message);
                return { statusCode: 400, headers, body: JSON.stringify({ error: `Failed to fetch URL: ${fetchErr.message}` }) };
            }

            type = 'url';
            // metadata already contains source_url from above
        } else if (action === 'set_context') {
            content = body.context || '';
            filename = 'Hot Topic Context';
            type = 'hot_topic';
            folderId = 'hot_topics';
            metadata.priority = 'high';
        } else {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'Unknown action' }) };
        }

        if (!content) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'No content' }) };
        }

        console.log(`[RAG] Saving: ${filename}, ${content.length} chars`);

        // Insert into knowledge_base only (fast, reliable)
        const { data, error } = await supabase
            .from('knowledge_base')
            .insert({
                project_id: folderId,
                tenant_id: reqTenantId,
                type,
                source_name: filename,
                content: content.substring(0, 5000),
                metadata: metadata,
                relevance_score: type === 'hot_topic' ? 10.0 : 1.0
            })
            .select('id')
            .single();

        if (error) {
            console.error('[RAG] DB error:', error.message);
            return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
        }

        console.log(`[RAG] Knowledge base success: ${data.id}. Starting instant indexing...`);

        // Instant Indexing into rag_chunks
        try {
            const chunks = chunkText(content.substring(0, 10000));
            console.log(`[RAG] Generated ${chunks.length} chunks`);

            for (const chunk of chunks) {
                const embedding = await generateEmbedding(chunk.text);
                if (embedding) {
                    await supabase.from('rag_chunks').upsert({
                        chunk_id: `${reqClientId}:${folderId}:${data.id}:${chunk.index}`,
                        client_id: reqClientId,
                        tenant_id: reqTenantId,
                        folder_id: folderId,
                        document_id: data.id,
                        content: chunk.text,
                        embedding: embedding,
                        metadata: {
                            ...metadata,
                            source_name: filename,
                            type: type,
                            chunk_index: chunk.index
                        }
                    });
                }
            }
            console.log(`[RAG] Instant indexing complete for ${data.id}`);
        } catch (indexErr: any) {
            console.error('[RAG] Instant indexing failed (non-fatal):', indexErr.message);
        }

        console.log(`[RAG] Success: ${data.id}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Indexed successfully',
                documentId: data.id
            })
        };

    } catch (error: any) {
        console.error(`[RAG] Error:`, error.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
