import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

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

            // Fetch URL with 8 second timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            try {
                console.log('[RAG] Fetching URL:', url);
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; AURO-Bot/1.0)',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
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
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'No content' }) };
        }

        console.log(`[RAG] Saving: ${filename}, ${content.length} chars`);

        // Insert into knowledge_base only (fast, reliable)
        const { data, error } = await supabase
            .from('knowledge_base')
            .insert({
                project_id: folderId,
                type,
                source_name: filename,
                content: content.substring(0, 5000),
                metadata: { ...metadata, client_id: clientId },
                relevance_score: type === 'hot_topic' ? 10.0 : 1.0
            })
            .select('id')
            .single();

        if (error) {
            console.error('[RAG] DB error:', error.message);
            return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
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
