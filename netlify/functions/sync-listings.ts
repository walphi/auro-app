import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const PARSEBOT_API_URL = process.env.PARSEBOT_API_URL || "";
const PARSEBOT_API_KEY = process.env.PARSEBOT_API_KEY || "";

interface ParseBotListing {
    id: string;
    title: string;
    description?: string;
    property_type: string;
    location: string;
    sub_location?: string;
    bedrooms: number;
    bathrooms: number;
    size_sqft: number;
    price: number;
    images: string[];
    agent?: {
        name: string;
        phone: string;
        company: string;
    };
    url: string;
    offering_type?: string;
}

interface ParseBotResponse {
    success: boolean;
    listings?: ParseBotListing[];
    data?: ParseBotListing[];
    error?: string;
}

async function fetchFromParseBot(): Promise<ParseBotListing[]> {
    if (!PARSEBOT_API_URL || !PARSEBOT_API_KEY) {
        console.error('[Sync] ParseBot credentials missing');
        return [];
    }

    try {
        console.log('[Sync] Fetching listings from ParseBot...');
        console.log('[Sync] API URL:', PARSEBOT_API_URL);
        
        const response = await fetch(PARSEBOT_API_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${PARSEBOT_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('[Sync] ParseBot API error:', response.status, response.statusText);
            return [];
        }

        const data: ParseBotResponse = await response.json();
        
        // Handle different response formats
        const listings = data.listings || data.data || [];
        console.log(`[Sync] Received ${listings.length} listings from ParseBot`);
        
        return listings;
    } catch (e: any) {
        console.error('[Sync] ParseBot fetch error:', e.message);
        return [];
    }
}

function transformListing(pbListing: ParseBotListing) {
    return {
        external_id: pbListing.id,
        title: pbListing.title,
        description: pbListing.description || null,
        property_type: pbListing.property_type?.toLowerCase() || 'apartment',
        offering_type: pbListing.offering_type?.toLowerCase() || 'sale',
        community: pbListing.location,
        sub_community: pbListing.sub_location || null,
        bedrooms: pbListing.bedrooms || 0,
        bathrooms: pbListing.bathrooms || 0,
        area_sqft: pbListing.size_sqft || null,
        price: pbListing.price || 0,
        price_per_sqft: pbListing.size_sqft && pbListing.price 
            ? Math.round(pbListing.price / pbListing.size_sqft) 
            : null,
        images: pbListing.images || [],
        agent_name: pbListing.agent?.name || null,
        agent_phone: pbListing.agent?.phone || null,
        agent_company: pbListing.agent?.company || null,
        source: 'parsebot',
        source_url: pbListing.url || null,
        status: 'active',
        synced_at: new Date().toISOString()
    };
}

async function syncListings(): Promise<{ synced: number; errors: number; skipped: number }> {
    const listings = await fetchFromParseBot();
    
    if (listings.length === 0) {
        console.log('[Sync] No listings to sync');
        return { synced: 0, errors: 0, skipped: 0 };
    }

    let synced = 0;
    let errors = 0;
    let skipped = 0;

    for (const pbListing of listings) {
        try {
            // Skip listings without required fields
            if (!pbListing.id || !pbListing.title) {
                console.log('[Sync] Skipping listing with missing id or title');
                skipped++;
                continue;
            }

            const transformed = transformListing(pbListing);
            
            const { error } = await supabase
                .from('property_listings')
                .upsert(transformed, {
                    onConflict: 'external_id',
                    ignoreDuplicates: false
                });

            if (error) {
                console.error(`[Sync] Error upserting listing ${pbListing.id}:`, error.message);
                errors++;
            } else {
                synced++;
            }
        } catch (e: any) {
            console.error(`[Sync] Exception processing listing:`, e.message);
            errors++;
        }
    }

    console.log(`[Sync] Complete: ${synced} synced, ${errors} errors, ${skipped} skipped`);
    return { synced, errors, skipped };
}

// Mark stale listings as inactive (not synced in last 24 hours)
async function deactivateStaleListings(): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
        .from('property_listings')
        .update({ status: 'inactive' })
        .eq('source', 'parsebot')
        .eq('status', 'active')
        .lt('synced_at', twentyFourHoursAgo)
        .select('id');

    if (error) {
        console.error('[Sync] Error deactivating stale listings:', error.message);
        return 0;
    }

    const deactivated = data?.length || 0;
    if (deactivated > 0) {
        console.log(`[Sync] Deactivated ${deactivated} stale listings`);
    }
    return deactivated;
}

// Manual trigger endpoint
const handler: Handler = async (event) => {
    console.log('[Sync] Manual sync triggered');
    
    // Optional: Add authentication check
    const authHeader = event.headers.authorization;
    const expectedKey = process.env.SYNC_API_KEY;
    
    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
        console.log('[Sync] Unauthorized request');
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Unauthorized' })
        };
    }

    // Check if we should skip deactivation (for testing)
    const skipDeactivation = event.queryStringParameters?.skipDeactivation === 'true';

    const syncResult = await syncListings();
    
    let deactivated = 0;
    if (!skipDeactivation) {
        deactivated = await deactivateStaleListings();
    }
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            ...syncResult,
            deactivated,
            timestamp: new Date().toISOString()
        }),
        headers: { 'Content-Type': 'application/json' }
    };
};

export { handler };
