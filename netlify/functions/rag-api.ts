import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as multipart from 'lambda-multipart-parser';
import * as cheerio from 'cheerio';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Helper to chunk text
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 100): string[] {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.substring(start, end));
        start += chunkSize - overlap;
    }
    return chunks;
}

// Helper to embed and store
async function embedAndStore(content: string, sourceName: string, type: string, projectId: string, metadata: any = {}, relevanceScore: number = 1.0) {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

    // Chunking
    const chunks = chunkText(content);

    for (const chunk of chunks) {
        const result = await model.embedContent(chunk);
        const embedding = result.embedding.values;

        const { error } = await supabase.from('knowledge_base').insert({
            project_id: projectId,
            type,
            source_name: sourceName,
            content: chunk,
            embedding,
            metadata,
            relevance_score: relevanceScore
        });

        if (error) throw error;
    }
}

export const handler: Handler = async (event, context) => {
    // Parse Path: /api/v1/client/{client_id}/rag/{action}
    // Netlify redirects to /.netlify/functions/rag-api
    // event.path might be /.netlify/functions/rag-api or the original path depending on config.
    // Usually with 'redirects', the event.path is the *destination* path.
    // But we can pass parameters via query string or try to parse the original URL if available.
    // Let's assume we passed parameters via query string in netlify.toml? No, I didn't.
    // Let's rely on the fact that I set "to = /.netlify/functions/rag-api"
    // Actually, a better way for the router is to check the segments.
    // But let's assume the client sends the action in the body or we rely on a query param I can add to the redirect?
    // Let's update netlify.toml to pass the action as a query param if possible, or just parse the URL.
    // Wait, I can't easily change the redirect to pass path segments as query params for *all* segments.

    // Alternative: The client (AgentFolders.jsx) calls the function directly or I parse the `event.path` if it preserves the original.
    // Netlify preserves the original path in `event.path` if using a rewrite (200).

    const pathSegments = event.path.split('/');
    // Expected: /api/v1/client/{client_id}/rag/{action}
    // indices: 0="", 1="api", 2="v1", 3="client", 4="{client_id}", 5="rag", 6="{action}"

    const clientId = pathSegments[4];
    const action = pathSegments[6];

    if (!clientId || !action) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid path format' }) };
    }

    // Mock Project ID for now (In real app, fetch project for client)
    // For MVP, we'll assume the client sends project_id in body or we pick the first one.
    // Let's look for project_id in body.

    try {
        if (action === 'upload_file') {
            const result = await multipart.parse(event);
            const file = result.files[0];
            const projectId = result.project_id || (await getDefaultProjectId(clientId));

            if (!file) return { statusCode: 400, body: 'No file uploaded' };

            let textContent = '';
            if (file.contentType === 'text/plain' || file.filename.endsWith('.txt')) {
                textContent = file.content.toString();
            } else {
                // PDF/DOCX support requires different approach in serverless environment
                return { statusCode: 400, body: 'Currently only .txt files are supported. PDF support coming soon.' };
            }

            await embedAndStore(textContent, file.filename, 'file', projectId);
            return { statusCode: 200, body: JSON.stringify({ success: true, message: 'File indexed' }) };
        }

        if (action === 'add_url') {
            const { url, project_id } = JSON.parse(event.body || '{}');
            const projectId = project_id || (await getDefaultProjectId(clientId));

            if (!url) return { statusCode: 400, body: 'Missing URL' };

            const response = await fetch(url);
            const html = await response.text();
            const $ = cheerio.load(html);

            // Clean HTML
            $('script').remove();
            $('style').remove();
            const text = $('body').text().replace(/\s+/g, ' ').trim();

            await embedAndStore(text, url, 'url', projectId);
            return { statusCode: 200, body: JSON.stringify({ success: true, message: 'URL indexed' }) };
        }

        if (action === 'set_context') {
            const { context, project_id } = JSON.parse(event.body || '{}');
            const projectId = project_id || (await getDefaultProjectId(clientId));

            if (!context) return { statusCode: 400, body: 'Missing context' };

            await embedAndStore(context, 'Manual Context', 'text', projectId, {}, 1.5); // Higher relevance
            return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Context set' }) };
        }

        return { statusCode: 404, body: 'Action not found' };

    } catch (error: any) {
        console.error(`Error in RAG API (${action}):`, error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};

async function getDefaultProjectId(clientId: string) {
    // Helper to get a default project if none provided
    const { data } = await supabase.from('projects').select('id').limit(1).single();
    return data?.id;
}
