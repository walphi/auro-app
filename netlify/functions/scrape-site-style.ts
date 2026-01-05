import { Handler } from '@netlify/functions';
import { supabase } from '../../lib/supabase';
import { RtrvrClient } from '../../lib/rtrvrClient';
import { SiteStyleProfile } from '../../shared/agent-sites-types';

const STYLE_SCRAPE_COMMAND = (url: string) => `
Go to ${url} and analyze the website's visual design and copywriting style.
Return a JSON object with these exact fields:
{
  "primaryColor": "hex color code of the main brand color",
  "secondaryColor": "hex color code of the accent color",
  "fontHints": ["list of font style descriptions like serif, modern, elegant"],
  "layoutHints": ["list of layout patterns like hero-full-width, card-grid, minimal-nav"],
  "toneHints": ["list of tone descriptors like luxury, professional, family-friendly"],
  "examplePhrases": ["3-5 example headlines or phrases that capture the site's voice"]
}
Only return the JSON object, no other text.
`;

export const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    try {
        const { url, agentId } = JSON.parse(event.body || '{}');
        if (!url || !agentId) {
            return { statusCode: 400, body: 'url and agentId required' };
        }

        console.log(`[scrape-site-style] Starting style analysis for ${url} (Agent: ${agentId})`);

        // 1. Check Cache (24h)
        const { data: cached } = await supabase
            .from('scrape_cache')
            .select('*')
            .eq('url', url)
            .eq('type', 'style')
            .gte('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .single();

        if (cached) {
            console.log(`[scrape-site-style] Cache hit for ${url}`);
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ok: true, data: cached.data })
            };
        }

        // 2. Scrape via rtrvr.ai
        const rtrvrApiKey = process.env.RTRVR_API_KEY;
        if (!rtrvrApiKey) {
            console.error('[scrape-site-style] RTRVR_API_KEY missing');
            return {
                statusCode: 500,
                body: JSON.stringify({ ok: false, error: 'Scraping service not configured (missing API key)' })
            };
        }

        const client = new RtrvrClient({
            apiKey: rtrvrApiKey,
            baseUrl: 'https://api.rtrvr.ai',
            timeout: 60000
        });

        const prompt = STYLE_SCRAPE_COMMAND(url);
        const result = await client.createTask(prompt);

        if (!result.success) {
            console.error(`[scrape-site-style] rtrvr.ai reported failure for ${url}: ${result.error || 'Unknown error'}`);
            return {
                statusCode: 422,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ok: false, error: result.error || 'Analysis failed' })
            };
        }

        // Normalize output
        const rawData = result.data;
        const profile: SiteStyleProfile = {
            ...rawData,
            sourceUrl: url
        };

        // 3. Cache Result
        await supabase.from('scrape_cache').insert({
            url,
            type: 'style',
            data: profile,
            scraped_at: new Date().toISOString()
        });

        console.log(`[scrape-site-style] Style analysis successful and cached for ${url}`);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ok: true, data: profile })
        };

    } catch (error: any) {
        console.error(`[scrape-site-style] Error during style analysis for URL ${event.body ? JSON.parse(event.body).url : 'unknown'}: ${error.message}`);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ok: false, error: error.message })
        };
    }
};
