import { createClient } from "@supabase/supabase-js";
import { convertImagesToJpeg, prepareImageForWhatsApp } from "./image-format-helper";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
console.log(`[Listings Helper] Init check: URL=${supabaseUrl ? 'SET' : 'MISSING'}, KEY=${supabaseKey ? 'SET' : 'MISSING'}`);
const supabase = createClient(supabaseUrl, supabaseKey);

export interface SearchFilters {
    property_type?: string;
    min_bedrooms?: number;
    max_bedrooms?: number;
    min_price?: number;
    max_price?: number;
    community?: string;
    offering_type?: string;
    limit?: number;
}

export interface PropertyListing {
    id: string;
    title: string;
    description?: string;
    property_type: string;
    community: string;
    sub_community: string;
    bedrooms: number;
    bathrooms: number;
    area_sqft: number;
    price: number;
    price_per_sqft: number;
    images: any[]; // Changed to any[] as it contains objects/strings
    image_url_jpeg?: string;
    agent_name?: string;
    agent_phone?: string;
    agent_company?: string;
    source_url?: string;
}

/**
 * Pure helper to choose the best available JPEG image for WhatsApp.
 * Prefer image_url_jpeg, then fallback to first image if it ends in .jpg/.jpeg
 * Automatically resolves blocked CloudFront URLs to public S3 URLs.
 */
export function getListingImageUrl(listing: any): string | null {
    // 1. Prefer image_url_jpeg if present
    if (listing.image_url_jpeg) {
        const resolved = resolveImageUrl(listing.image_url_jpeg);
        if (resolved) return resolved;
    }

    // 2. Fall back to first JPEG in images[]
    const images = Array.isArray(listing.images) ? listing.images : [];
    if (images.length === 0) return null;

    const first = images[0]?.url || images[0];
    if (typeof first === 'string' && /\.(jpe?g|webp)$/i.test(first)) {
        const resolved = resolveImageUrl(first);
        if (resolved) return resolved;
    }

    return null;
}
/**
 * Builds a URL that points to our image proxy.
 * This ensures Twilio can fetch images that are otherwise AccessDenied.
 */
export function buildProxyImageUrl(listing: any, index: number = 0, host?: string): string | null {
    const baseUrl = host ? `https://${host}` : (process.env.URL || "https://auro-app.netlify.app");

    // If we have a DB ID, use the pretty /property-image/ID path
    if (listing.id) {
        return `${baseUrl}/property-image/${listing.id}/${index}.jpg`;
    }

    // Fallback: pass the source URL as a param
    const src = getListingImageUrl(listing);
    if (!src) return null;
    return `${baseUrl}/.netlify/functions/image-proxy?src=${encodeURIComponent(src)}`;
}
/**
 * Resolves blocked CloudFront URLs to public S3 URLs where possible.
 * Filters for known blocked CDNs if they cannot be resolved.
 */
function resolveImageUrl(url: string): string | null {
    if (!url) return null;

    console.log(`[Images] resolveImageUrl testing: ${url}`);

    // Pattern: CloudFront "x/" resize paths which are AccessDenied
    // Example: https://d3h330vgpwpjr8.cloudfront.net/x/ggfx-providentestate.s3.eu-west-2.amazonaws.com/i/...
    if (url.includes('d3h330vgpwpjr8.cloudfront.net/x/')) {
        console.log(`[Images] Resolving blocked CloudFront URL: ${url}`);

        // Strip the CloudFront prefix part to show the direct S3 URL which is typically appended after /x/
        let resolved = url.replace(/https?:\/\/d3h330vgpwpjr8\.cloudfront\.net\/x\//i, 'https://');

        // Remove resolution part if present (e.g., /464x312/)
        resolved = resolved.replace(/\/\d+x\d+\//, '/');

        // Force .jpg
        resolved = resolved.replace(/\.webp$/i, '.jpg');

        console.log(`[Images] Resolved successfully to: ${resolved}`);
        return resolved;
    }

    // Pattern: Other CloudFront URLs (usually blocked if hit directly by Twilio)
    // We used to return null here, but now we allow them through so the proxy can attempt to fetch them
    // with its custom headers (User-Agent, Referer) which often bypasses the block.
    if (url.includes('cloudfront.net')) {
        console.log(`[Images] Matches generic CloudFront pattern - allowing through for proxying`);
        return url;
    }

    console.log(`[Images] No blocked patterns matched, returning original URL`);
    return url;
}

export async function getListingById(id: string): Promise<{ data: PropertyListing | null, error: string | null }> {
    try {
        const { data, error } = await supabase
            .from('property_listings')
            .select('*')
            .eq('id', id)
            .limit(1);

        if (error) {
            console.error(`[Listings] Error fetching listing ${id}:`, error);
            return { data: null, error: error.message };
        }

        if (!data || data.length === 0) {
            return { data: null, error: null };
        }

        // Return the first match
        return { data: data[0] as PropertyListing, error: null };
    } catch (e: any) {
        console.error(`[Listings] Exception fetching listing ${id}:`, e.message);
        return { data: null, error: e.message };
    }
}

export async function searchListings(filters: SearchFilters): Promise<PropertyListing[]> {
    console.log('[Listings] Searching with filters:', JSON.stringify(filters, null, 2));

    try {
        // Try RPC function first
        const { data, error } = await supabase.rpc('search_property_listings', {
            p_property_type: filters.property_type || null,
            p_min_bedrooms: filters.min_bedrooms || null,
            p_max_bedrooms: filters.max_bedrooms || null,
            p_min_price: filters.min_price || null,
            p_max_price: filters.max_price || null,
            p_community: filters.community || null,
            p_offering_type: filters.offering_type || 'sale',
            p_limit: filters.limit || 3
        });

        if (error) {
            console.error('[Listings] RPC search error:', error);
            // Fall back to direct query
            return await directSearch(filters);
        }

        console.log(`[Listings] Found ${data?.length || 0} results via RPC`);
        return data || [];

    } catch (e: any) {
        console.error('[Listings] Search exception:', e.message);
        return await directSearch(filters);
    }
}

async function directSearch(filters: SearchFilters): Promise<PropertyListing[]> {
    console.log('[Listings] Falling back to direct query');

    try {
        let query = supabase
            .from('property_listings')
            .select('id, title, description, property_type, community, sub_community, bedrooms, bathrooms, area_sqft, price, price_per_sqft, images, image_url_jpeg, agent_name, agent_phone, source_url')
            .eq('status', 'active');

        if (filters.property_type) {
            query = query.ilike('property_type', filters.property_type);
        }
        if (filters.community) {
            query = query.ilike('community', `%${filters.community}%`);
        }
        if (filters.min_bedrooms) {
            query = query.gte('bedrooms', filters.min_bedrooms);
        }
        if (filters.max_bedrooms) {
            query = query.lte('bedrooms', filters.max_bedrooms);
        }
        if (filters.min_price) {
            query = query.gte('price', filters.min_price);
        }
        if (filters.max_price) {
            query = query.lte('price', filters.max_price);
        }
        if (filters.offering_type) {
            query = query.eq('offering_type', filters.offering_type.toLowerCase());
        }

        const { data, error } = await query
            .order('featured', { ascending: false })
            .order('updated_at', { ascending: false })
            .limit(filters.limit || 3);

        if (error) {
            console.error('[Listings] Direct search error:', error);
            return [];
        }

        return data || [];
    } catch (e: any) {
        console.error('[Listings] Direct search exception:', e.message);
        return [];
    }
}

export interface ListingsResponse {
    text: string;
    images: string[];
}

export function formatListingsResponse(listings: PropertyListing[], host?: string): ListingsResponse {
    if (!listings || listings.length === 0) {
        return {
            text: "I couldn't find any properties matching your criteria. Would you like me to broaden the search or try different filters?",
            images: []
        };
    }

    let response = `I found ${listings.length} ${listings.length === 1 ? 'property' : 'properties'} that match your criteria:\n\n`;
    const images: string[] = [];

    listings.forEach((listing, index) => {
        const price = new Intl.NumberFormat('en-AE', {
            style: 'currency',
            currency: 'AED',
            maximumFractionDigits: 0
        }).format(listing.price);

        const area = listing.area_sqft
            ? `${new Intl.NumberFormat().format(listing.area_sqft)} sqft`
            : 'N/A';

        response += `${index + 1}. *${listing.title}*\n`;
        response += `   📍 ${listing.community}${listing.sub_community ? ` - ${listing.sub_community}` : ''}\n`;
        response += `   🏠 ${listing.bedrooms || 'Studio'} BR | ${listing.bathrooms || 0} BA | ${area}\n`;
        response += `   💰 ${price}\n`;

        // Use the image proxy for reliable WhatsApp delivery
        const imageUrl = buildProxyImageUrl(listing, 0, host);
        if (imageUrl) {
            images.push(imageUrl);
            console.log(`[Listings] Using proxy image for WhatsApp: ${imageUrl}`);
        }
        response += '\n';
    });

    response += "Would you like more details on any of these properties, or should I refine the search?";

    return {
        text: response,
        images: images
    };
}

// Voice-friendly format for VAPI
export function formatListingsForVoice(listings: PropertyListing[]): string {
    if (!listings || listings.length === 0) {
        return "I couldn't find any properties matching your criteria. Would you like me to broaden the search or try different filters?";
    }

    let response = `I found ${listings.length} properties that match your criteria. `;

    listings.forEach((listing, index) => {
        const priceInMillions = listing.price / 1000000;
        const priceFormatted = priceInMillions >= 1
            ? `${priceInMillions.toFixed(1)} million dirhams`
            : `${new Intl.NumberFormat().format(listing.price)} dirhams`;

        const bedroomText = listing.bedrooms === 0 || !listing.bedrooms
            ? 'studio'
            : `${listing.bedrooms} bedroom`;

        response += `Property ${index + 1}: A ${bedroomText} ${listing.property_type || 'apartment'} in ${listing.community}`;
        if (listing.sub_community) {
            response += `, ${listing.sub_community}`;
        }
        response += `, priced at ${priceFormatted}. `;
    });

    response += "Would you like more details on any of these properties?";

    return response;
}
