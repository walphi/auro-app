import { Handler } from '@netlify/functions';
import { supabase } from '../../lib/supabase';
import { FirecrawlClient } from "../../lib/firecrawlClient";
import { SiteStyleProfile } from '../../shared/agent-sites-types';

const STYLE_SCRAPE_PROMPT = (url: string) => `
You are a website style analyzer. 
Analyze this URL: ${url}
Return details about the site's visual design (colors, fonts, layout) and copywriting tone.
`;

const STYLE_SCHEMA = {
    type: "object",
    properties: {
        primaryColor: { type: "string" },
        secondaryColor: { type: "string" },
        fontHints: { type: "array", items: { type: "string" } },
        layoutHints: { type: "array", items: { type: "string" } },
        toneHints: { type: "array", items: { type: "string" } },
        examplePhrases: { type: "array", items: { type: "string" } }
    }
};

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

        console.log("[scrape-site-style] Calling Firecrawl v2 for URL:", url);
        const result = await firecrawl.scrapeJson(
            url,
            STYLE_SCRAPE_PROMPT(url),
            STYLE_SCHEMA
        );

        if (!result.success || !result.data?.json) {
            console.error("[scrape-site-style] Firecrawl error:", JSON.stringify(result.error));
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
