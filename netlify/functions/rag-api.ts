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

            // Fetch URL with 5 second timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            try {
                const response = await fetch(url, {
                    headers: { 'User-Agent': 'AURO-Bot/1.0' },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const html = await response.text();
                const $ = cheerio.load(html);
                $('script, style, nav, footer, header').remove();
                content = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 10000);
                filename = $('title').text() || url;
            } catch (fetchErr: any) {
                clearTimeout(timeoutId);
                console.error('[RAG] URL fetch error:', fetchErr.message);
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Failed to fetch URL' }) };
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
