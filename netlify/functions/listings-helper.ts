import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
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
    property_type: string;
    community: string;
    sub_community: string;
    bedrooms: number;
    bathrooms: number;
    area_sqft: number;
    price: number;
    price_per_sqft: number;
    images: string[];
    agent_name: string;
    agent_phone: string;
    source_url: string;
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
            .select('id, title, property_type, community, sub_community, bedrooms, bathrooms, area_sqft, price, price_per_sqft, images, agent_name, agent_phone, source_url')
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

export function formatListingsResponse(listings: PropertyListing[]): string {
    if (!listings || listings.length === 0) {
        return "I couldn't find any properties matching your criteria. Would you like me to broaden the search or try different filters?";
    }

    let response = `I found ${listings.length} properties that match your criteria:\n\n`;

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
        
        if (listing.images && Array.isArray(listing.images) && listing.images.length > 0) {
            response += `   🖼️ ${listing.images[0]}\n`;
        }
        response += '\n';
    });

    response += "Would you like more details on any of these properties, or should I refine the search?";
    
    return response;
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
