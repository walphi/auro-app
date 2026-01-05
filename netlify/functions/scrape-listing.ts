import { Handler } from '@netlify/functions';
import { supabase } from '../../lib/supabase';
import { RtrvrClient } from '../../lib/rtrvrClient';
import { ScrapedListingDraft, PortalSource } from '../../shared/agent-sites-types';

const LISTING_SCRAPE_COMMAND = (url: string) => `
Go to ${url} and extract the property listing details.
Return a JSON object with these exact fields:
{
  "title": "property title/name",
  "towerOrCommunity": "building or community name",
  "type": "rent" or "sale" or "offplan",
  "price": number (no commas, just digits),
  "currency": "AED" or "USD",
  "beds": number of bedrooms (0 for studio),
  "baths": number of bathrooms,
  "sizeSqft": size in square feet (number),
  "features": ["feature1", "feature2", ...],
  "photos": ["url1", "url2", ...],
  "description": "full property description text"
}
Only return the JSON object, no other text.
`;

function inferSource(url: string): PortalSource {
    if (url.includes('bayut.com')) return 'bayut';
    if (url.includes('propertyfinder')) return 'propertyFinder';
    if (url.includes('dubizzle')) return 'dubizzle';
    return 'other';
}

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

        // 2. Scrape via rtrvr.ai
        const rtrvrApiKey = process.env.RTRVR_API_KEY;
        if (!rtrvrApiKey) {
            console.error('[scrape-listing] RTRVR_API_KEY missing');
            return {
                statusCode: 500,
                body: JSON.stringify({ ok: false, error: 'Scraping service not configured (missing API key)' })
            };
        }

        const client = new RtrvrClient({
            apiKey: rtrvrApiKey,
            baseUrl: 'https://api.rtrvr.ai/v1',
            timeout: 60000
        });

        const prompt = LISTING_SCRAPE_COMMAND(url);
        const result = await client.createTask(prompt);

        if (!result.success) {
            console.error(`[scrape-listing] rtrvr.ai reported failure for ${url}: ${result.error || 'Unknown error'}`);
            return {
                statusCode: 422,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ok: false, error: result.error || 'Scraping failed' })
            };
        }

        // Normalize output
        const rawData = result.data;
        const draft: ScrapedListingDraft = {
            ...rawData,
            sourceUrl: url,
            source: inferSource(url),
            scrapedAt: new Date().toISOString(),
            confidence: 0.9
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
        console.error(`[scrape-listing] Error during scrape for URL ${event.body ? JSON.parse(event.body).url : 'unknown'}: ${error.message}`);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ok: false, error: error.message })
        };
    }
};
