import { Handler } from '@netlify/functions';
import { supabase } from '../../lib/supabase';
import { FirecrawlClient } from "../../lib/firecrawlClient";
import { ScrapedListingDraft, PortalSource } from '../../shared/agent-sites-types';

const LISTING_SCRAPE_PROMPT = (url: string) => `
You are a real estate listing extractor.

Go to this URL: ${url}

Extract and return a single JSON object with exactly these fields:

- "title": string, the property title/name.
- "towerOrCommunity": string, building or community name.
- "type": string, one of "rent", "sale", or "offplan".
- "price": number, numeric price without commas.
- "currency": string, e.g. "AED" or "USD".
- "beds": number, bedrooms (0 for studio).
- "baths": number, bathrooms.
- "sizeSqft": number, size in square feet.
- "features": string, a comma-separated list of key features.
- "photos": string[], array of photo URLs.
- "description": string, full property description text.

Important rules:
- Only return the JSON object as the "json" field, no prose.
- If a field is missing on the page, still include it with a null or sensible default.
`;

function inferSource(url: string): PortalSource {
    if (url.includes('bayut.com')) return 'bayut';
    if (url.includes('propertyfinder')) return 'propertyFinder';
    if (url.includes('dubizzle')) return 'dubizzle';
    return 'other';
}

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

        console.log(`[scrape-listing] Starting scrape for ${url} (Agent: ${agentId})`);

        // 1. Check Cache (24h)
        const { data: cached } = await supabase
            .from('scrape_cache')
            .select('*')
            .eq('url', url)
            .eq('type', 'listing')
            .gte('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .single();

        if (cached) {
            console.log(`[scrape-listing] Cache hit for ${url}`);
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ok: true, data: cached.data })
            };
        }

        // 2. Scrape via Firecrawl
        if (!process.env.FIRECRAWL_API_KEY) {
            console.error('[scrape-listing] FIRECRAWL_API_KEY missing');
            return {
                statusCode: 500,
                body: JSON.stringify({ ok: false, error: 'Scraping service not configured (missing API key)' })
            };
        }

        console.log("[scrape-listing] Calling Firecrawl for URL:", url);
        const result = await firecrawl.scrapeJson(
            url,
            LISTING_SCRAPE_PROMPT(url)
        );

        if (!result.success || !result.data?.json) {
            console.error("[scrape-listing] Firecrawl error:", result.error);
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

        // Map into ScrapedListingDraft shape
        const draft: ScrapedListingDraft = {
            sourceUrl: url,
            source: inferSource(url),
            title: json.title ?? null,
            towerOrCommunity: json.towerOrCommunity ?? null,
            type: json.type ?? null,
            price: json.price ?? null,
            currency: json.currency ?? null,
            beds: json.beds ?? null,
            baths: json.baths ?? null,
            sizeSqft: json.sizeSqft ?? null,
            features: json.features ?? null,
            photos: json.photos ?? [],
            description: json.description ?? null,
            agentName: json.agentName ?? null,
            scrapedAt: new Date().toISOString(),
            confidence: 0.9,
        };

        // 3. Cache Result
        await supabase.from('scrape_cache').insert({
            url,
            type: 'listing',
            data: draft,
            scraped_at: new Date().toISOString()
        });

        console.log(`[scrape-listing] Scrape successful and cached for ${url}`);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ok: true, data: draft })
        };

    } catch (error: any) {
        console.error(`[scrape-listing] Unexpected error: ${error.message}`);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ok: false, error: "INTERNAL_ERROR", message: error.message })
        };
    }
};
