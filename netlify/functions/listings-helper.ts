// listings-helper.ts - Provident Real Estate Listings API Integration
// This module provides real-time property listing search for WhatsApp and Voice agents

export interface ListingSearchParams {
    location?: string;
    property_type?: string;
    min_price?: number;
    max_price?: number;
    bedrooms?: number;
    bathrooms?: number;
    min_size?: number;
    max_size?: number;
    status?: string;
    limit?: number;
}

export interface PropertyListing {
    id: string;
    title: string;
    property_type: string;
    location: string;
    area: string;
    price: number;
    bedrooms: number;
    bathrooms: number;
    size_sqft: number;
    status: string;
    description?: string;
    image_url?: string;
    listing_url?: string;
}

// Configuration - Update these when you have the actual API details
const LISTINGS_CONFIG = {
    baseUrl: process.env.PROVIDENT_API_URL || 'https://api.provident.ae/v1',
    apiKey: process.env.PROVIDENT_API_KEY || '',
    authHeader: process.env.PROVIDENT_AUTH_HEADER || 'X-API-Key',
    authPrefix: process.env.PROVIDENT_AUTH_PREFIX || '',
};

/**
 * Transform API response to standard PropertyListing format
 * UPDATE THIS FUNCTION when you know the actual API response structure
 */
function transformApiResponse(apiData: any): PropertyListing[] {
    // Handle various response structures
    const listings = Array.isArray(apiData) 
        ? apiData 
        : apiData.listings || apiData.properties || apiData.data || apiData.results || [];
    
    return listings.map((item: any) => ({
        id: item.id || item.reference || item.listing_id || item.ref,
        title: item.title || item.name || generateTitle(item),
        property_type: item.property_type || item.type || item.category || 'Property',
        location: item.location || item.community || item.area || item.neighborhood,
        area: item.area || item.sub_community || item.district || item.sub_area || '',
        price: parseFloat(item.price || item.asking_price || item.sale_price || item.amount || 0),
        bedrooms: parseInt(item.bedrooms || item.beds || item.br || item.bed || 0),
        bathrooms: parseInt(item.bathrooms || item.baths || item.bath || 0),
        size_sqft: parseFloat(item.size || item.size_sqft || item.area_sqft || item.built_up_area || item.sqft || 0),
        status: item.status || item.availability || item.available ? 'Available' : 'Available',
        description: item.description || item.details || item.summary,
        image_url: item.image_url || item.photo || item.main_image || item.image,
        listing_url: item.url || item.listing_url || item.link || item.property_url,
    }));
}

/**
 * Generate a title if none provided
 */
function generateTitle(item: any): string {
    const beds = item.bedrooms || item.beds || item.br || '?';
    const type = item.property_type || item.type || 'Property';
    const location = item.location || item.community || item.area || 'Dubai';
    return `${beds} BR ${type} in ${location}`;
}

/**
 * Build query parameters for API request
 * UPDATE THIS FUNCTION when you know the actual API parameter names
 */
function buildQueryParams(params: ListingSearchParams): Record<string, string> {
    const queryParams: Record<string, string> = {};
    
    // Map standard params to API-specific params
    // Adjust these mappings based on actual API documentation
    if (params.location) queryParams['location'] = params.location;
    if (params.property_type) queryParams['property_type'] = params.property_type;
    if (params.min_price) queryParams['min_price'] = params.min_price.toString();
    if (params.max_price) queryParams['max_price'] = params.max_price.toString();
    if (params.bedrooms !== undefined) queryParams['bedrooms'] = params.bedrooms.toString();
    if (params.bathrooms !== undefined) queryParams['bathrooms'] = params.bathrooms.toString();
    if (params.min_size) queryParams['min_size'] = params.min_size.toString();
    if (params.max_size) queryParams['max_size'] = params.max_size.toString();
    if (params.status) queryParams['status'] = params.status;
    queryParams['limit'] = (params.limit || 5).toString();
    
    return queryParams;
}

/**
 * Format price for display (e.g., 1.8M AED, 950K AED)
 */
function formatPrice(price: number): string {
    if (price >= 1000000) {
        return `${(price / 1000000).toFixed(1)}M AED`;
    } else if (price >= 1000) {
        return `${(price / 1000).toFixed(0)}K AED`;
    }
    return `${price.toLocaleString()} AED`;
}

/**
 * Search Provident property listings
 * Returns formatted string suitable for conversation
 */
export async function searchListings(params: ListingSearchParams): Promise<string> {
    if (!LISTINGS_CONFIG.apiKey) {
        console.error('[Listings] API key not configured');
        return 'Property listings search is currently unavailable. Our sales team can provide you with the latest listings - would you like me to schedule a call?';
    }

    try {
        console.log('[Listings] Searching with params:', JSON.stringify(params));
        
        const queryParams = buildQueryParams(params);
        const queryString = new URLSearchParams(queryParams).toString();
        const url = `${LISTINGS_CONFIG.baseUrl}/listings?${queryString}`;
        
        console.log('[Listings] Fetching:', url);
        
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
        
        // Add authentication header
        headers[LISTINGS_CONFIG.authHeader] = `${LISTINGS_CONFIG.authPrefix}${LISTINGS_CONFIG.apiKey}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        const response = await fetch(url, {
            method: 'GET',
            headers,
            signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Listings] API error:', response.status, errorText);
            return 'Unable to fetch listings at the moment. Would you like me to have a specialist call you with the latest available properties?';
        }

        const data = await response.json();
        const listings = transformApiResponse(data);
        
        console.log('[Listings] Found', listings.length, 'properties');

        if (listings.length === 0) {
            const criteria = [];
            if (params.location) criteria.push(params.location);
            if (params.bedrooms) criteria.push(`${params.bedrooms} bedroom`);
            if (params.max_price) criteria.push(`under ${formatPrice(params.max_price)}`);
            
            return `No properties found ${criteria.length ? 'matching ' + criteria.join(', ') : 'with those criteria'}. Would you like to adjust your search, or shall I have a specialist find off-market opportunities for you?`;
        }

        // Format listings for conversation
        const displayLimit = params.limit || 3;
        const formattedListings = listings.slice(0, displayLimit).map((listing, index) => {
            return `${index + 1}. **${listing.title}**
   - Location: ${listing.location}${listing.area ? `, ${listing.area}` : ''}
   - Price: ${formatPrice(listing.price)}
   - Beds/Baths: ${listing.bedrooms} BR / ${listing.bathrooms} BA
   - Size: ${listing.size_sqft.toLocaleString()} sqft
   - Status: ${listing.status}`;
        }).join('\n\n');

        const totalNote = listings.length > displayLimit 
            ? `\n\n(Showing ${displayLimit} of ${listings.length} matching properties)` 
            : '';

        return `Found ${listings.length} matching properties:\n\n${formattedListings}${totalNote}`;

    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.error('[Listings] Request timeout');
            return 'The listing search timed out. Would you like me to try again or schedule a call with a specialist?';
        }
        console.error('[Listings] Exception:', error.message);
        return 'Error searching listings. Please try again or let me connect you with a specialist.';
    }
}

/**
 * Get detailed information about a specific listing
 */
export async function getListingDetails(listingId: string): Promise<string> {
    if (!LISTINGS_CONFIG.apiKey) {
        return 'Property details are currently unavailable. Would you like me to have a specialist follow up with this information?';
    }

    try {
        console.log('[Listings] Fetching details for:', listingId);
        
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
        headers[LISTINGS_CONFIG.authHeader] = `${LISTINGS_CONFIG.authPrefix}${LISTINGS_CONFIG.apiKey}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${LISTINGS_CONFIG.baseUrl}/listings/${listingId}`, {
            method: 'GET',
            headers,
            signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error('[Listings] Details API error:', response.status);
            return 'Unable to fetch listing details at the moment.';
        }

        const data = await response.json();
        const listings = transformApiResponse([data]);
        const listing = listings[0];

        if (!listing) {
            return 'Listing not found. It may have been sold or removed.';
        }

        let details = `**${listing.title}**\n`;
        details += `- Reference: ${listing.id}\n`;
        details += `- Location: ${listing.location}${listing.area ? `, ${listing.area}` : ''}\n`;
        details += `- Price: ${formatPrice(listing.price)}\n`;
        details += `- Bedrooms: ${listing.bedrooms}\n`;
        details += `- Bathrooms: ${listing.bathrooms}\n`;
        details += `- Size: ${listing.size_sqft.toLocaleString()} sqft\n`;
        details += `- Status: ${listing.status}`;
        
        if (listing.description) {
            details += `\n\nDescription: ${listing.description.substring(0, 200)}${listing.description.length > 200 ? '...' : ''}`;
        }
        
        if (listing.listing_url) {
            details += `\n\nView listing: ${listing.listing_url}`;
        }

        return details;

    } catch (error: any) {
        console.error('[Listings] Details exception:', error.message);
        return 'Error fetching listing details. Please try again.';
    }
}

/**
 * Get featured/highlighted listings (no filters)
 */
export async function getFeaturedListings(limit: number = 3): Promise<string> {
    return searchListings({ limit, status: 'featured' });
}
