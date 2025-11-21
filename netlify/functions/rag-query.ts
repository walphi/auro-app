import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const handler: Handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const token = event.headers['x-antigravity-token'];
    if (token !== process.env.ANTIGRAVITY_API_TOKEN) {
        console.warn("Warning: Missing or invalid X-Antigravity-Token");
    }

    try {
        const { query, project_id, match_count = 5 } = JSON.parse(event.body || '{}');

        if (!query) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing query' }) };
        }

        // 1. Generate Embedding
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(query);
        const embedding = result.embedding.values;

        // 2. Query Supabase Vector Store
        const { data, error } = await supabase.rpc('match_knowledge', {
            query_embedding: embedding,
            match_threshold: 0.5, // Adjust as needed
            match_count: match_count,
            filter_project_id: project_id || null // If null, might search all or need logic
        });

        if (error) throw error;

        // 3. Format Response
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                data: data.map((item: any) => ({
                    content: item.content,
                    source: item.source_name,
                    similarity: item.similarity
                }))
            }),
        };

    } catch (error: any) {
        console.error('Error in RAG Query:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
