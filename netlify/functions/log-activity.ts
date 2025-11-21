import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export const handler: Handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const token = event.headers['x-antigravity-token'];
    if (token !== process.env.ANTIGRAVITY_API_TOKEN) {
        console.warn("Warning: Missing or invalid X-Antigravity-Token");
    }

    try {
        const { lead_id, type, content, sender, metadata } = JSON.parse(event.body || '{}');

        if (!lead_id || !content) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
        }

        // Log Activity (Insert into messages table as system note or transcript)
        const { data, error } = await supabase
            .from('messages')
            .insert({
                lead_id,
                type: type || 'System_Note',
                sender: sender || 'System',
                content,
                metadata: metadata || {}
            })
            .select();

        if (error) throw error;

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, data }),
        };
    } catch (error: any) {
        console.error('Error logging activity:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
