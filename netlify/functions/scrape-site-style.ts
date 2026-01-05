import { Handler } from '@netlify/functions';
import { supabase } from '../../lib/supabase';
import { FirecrawlClient } from "../../lib/firecrawlClient";
import { SiteStyleProfile } from '../../shared/agent-sites-types';

const STYLE_SCRAPE_PROMPT = (url: string) => `
You are a website style analyzer.

Go to this URL: ${url}

Return a JSON object with these fields describing the site's visual and copy style:

- "primaryColor": string, main brand color hex like "#1a365d" if you can infer it.
- "secondaryColor": string, secondary accent color hex.
- "fontHints": string[], a few words like ["serif", "elegant"].
- "layoutHints": string[], e.g. ["hero-full-width", "card-grid", "minimal-nav"].
- "toneHints": string[], e.g. ["luxury", "professional"].
- "examplePhrases": string[], 2-4 short phrase examples of the copy style.

Only return the JSON object as the "json" field, no prose.
`;

const firecrawl = new FirecrawlClient({
    apiKey: process.env.FIRECRAWL_API_KEY!,
    baseUrl: "https://api.firecrawl.dev/v1",
    timeoutMs: 60000,
});

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

        // 2. Scrape via Firecrawl
        if (!process.env.FIRECRAWL_API_KEY) {
            console.error('[scrape-site-style] FIRECRAWL_API_KEY missing');
            return {
                statusCode: 500,
                body: JSON.stringify({ ok: false, error: 'Scraping service not configured (missing API key)' })
            };
        }

        console.log("[scrape-site-style] Calling Firecrawl for URL:", url);
        const result = await firecrawl.scrapeJson(
            url,
            STYLE_SCRAPE_PROMPT(url)
        );

        if (!result.success || !result.data?.json) {
            console.error("[scrape-site-style] Firecrawl error:", result.error);
            return {
                statusCode: 422,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ok: false,
                    error: "SCRAPE_FAILED",
                    details: result.error,
                }),
            };
        }

        const json = result.data.json;

        const profile: SiteStyleProfile = {
            sourceUrl: url,
            primaryColor: json.primaryColor ?? null,
            secondaryColor: json.secondaryColor ?? null,
            fontHints: json.fontHints ?? [],
            layoutHints: json.layoutHints ?? [],
            toneHints: json.toneHints ?? [],
            examplePhrases: json.examplePhrases ?? [],
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
        console.error(`[scrape-site-style] Unexpected error: ${error.message}`);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ok: false, error: "INTERNAL_ERROR", message: error.message })
        };
    }
};
