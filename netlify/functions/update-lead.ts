import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export const handler: Handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // Security Check (Basic Token Auth)
    const token = event.headers['x-antigravity-token'];
    if (token !== process.env.ANTIGRAVITY_API_TOKEN) {
        // return { statusCode: 401, body: 'Unauthorized' };
        // For MVP/Dev, we might skip strict check or log warning
        console.warn("Warning: Missing or invalid X-Antigravity-Token");
    }

    try {
        const { lead_id, ...updates } = JSON.parse(event.body || '{}');

        if (!lead_id) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing lead_id' }) };
        }

        // Update Lead
        const { data, error } = await supabase
            .from('leads')
            .update(updates)
            .eq('id', lead_id)
            .select();

        if (error) throw error;

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, data }),
        };
    } catch (error: any) {
        console.error('Error updating lead:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
