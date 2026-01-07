
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export const handler: Handler = async (event) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    const { slug } = event.queryStringParameters || {};

    if (!slug) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Slug is required' }),
        };
    }

    try {
        console.log(`[get-agent-site] Fetching data for slug: ${slug}`);

        const { data: config, error } = await supabase
            .from('agentconfigs')
            .select('*')
            .eq('slug', slug)
            .single();

        if (error || !config) {
            console.error(`[get-agent-site] Config not found for slug: ${slug}`, error);
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Agent site not found' }),
            };
        }

        if (config.status !== 'live' && config.status !== 'published') {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({
                    error: 'Not published yet',
                    message: "This agent site is not published yet. Please contact the broker for the correct link."
                }),
            };
        }

        // Return the config
        console.log(`[get-agent-site] Returning config for ${slug}`, {
            status: config.status,
            agentId: config.agent_id,
            listingsCount: config.listings?.length || 0
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(config),
        };
    } catch (error: any) {
        console.error('[get-agent-site] Unexpected error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error', message: error.message }),
        };
    }
};
