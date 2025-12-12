/**
 * Listings Helper Module
 * Handles parse.bot API integration and property listings management
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Types
export interface PropertyListing {
  property_id: string;
  property_title: string;
  property_url: string;
  property_type: string | null;
  transaction_type: string;
  community: string | null;
  project_name: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  built_up_area_sqft: number | null;
  plot_area_sqft: number | null;
  price_aed: number | null;
  price_currency: string;
  payment_plan_available: string | null;
  handover_status: string | null;
  developer_name: string | null;
  furnishing_status: string | null;
  key_features: string[];
  agent_name: string | null;
  agent_phone: string | null;
  image_urls: string[];
  breadcrumb_location: string | null;
}

export interface ParseBotListing {
  property_title: string;
  property_url: string;
  property_type: string | null;
  transaction_type: string;
  community: string | null;
  project: string | null;
  project_name?: string | null;
  number_of_bedrooms: number | null;
  number_of_bathrooms: number | null;
  built_up_area_sqft: number | null;
  plot_area_sqft: number | null;
  price_aed: number | null;
  price_currency: string;
  payment_plan_available: string | null;
  handover_status: string | null;
  developer_name: string | null;
  furnishing_status: string | null;
  key_features: string[] | null;
  agent_name: string | null;
  agent_phone: string | null;
  image_urls: string[] | null;
  breadcrumb_location_hierarchy: string | null;
}

export interface SearchFilters {
  property_type?: string;
  min_bedrooms?: number;
  max_bedrooms?: number;
  min_price?: number;
  max_price?: number;
  community?: string;
  limit?: number;
}

// Parse.bot API configuration
const PARSEBOT_API_KEY = process.env.PARSEBOT_API_KEY || "";
const PARSEBOT_SCRAPER_ID = process.env.PARSEBOT_SCRAPER_ID || "98f4861a-6e6b-41ed-8efe-f9ff96ee8fe8";
const PARSEBOT_BASE_URL = `https://api.parse.bot/scraper/${PARSEBOT_SCRAPER_ID}`;

// Initialize Supabase client
function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Generate a unique property ID from URL
 */
function generatePropertyId(url: string): string {
  // Extract the last path segment or use a hash
  const urlParts = url.split('/').filter(Boolean);
  const lastPart = urlParts[urlParts.length - 1] || '';
  // Remove query params and create a clean ID
  return lastPart.split('?')[0] || `prop-${Date.now()}`;
}

/**
 * Fetch property listings from parse.bot API
 */
export async function fetchFromParseBot(limit: number = 10): Promise<ParseBotListing[]> {
  if (!PARSEBOT_API_KEY) {
    console.error("[Listings] PARSEBOT_API_KEY not configured");
    throw new Error("parse.bot API key not configured");
  }

  console.log(`[Listings] Fetching ${limit} listings from parse.bot...`);

  try {
    const response = await fetch(`${PARSEBOT_BASE_URL}/aggregate_properties`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PARSEBOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ limit })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Listings] parse.bot API error: ${response.status} - ${errorText}`);
      throw new Error(`parse.bot API returned ${response.status}`);
    }

    const data = await response.json();
    console.log(`[Listings] Received ${Array.isArray(data) ? data.length : 0} listings from parse.bot`);
    
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    console.error("[Listings] Error fetching from parse.bot:", error.message);
    throw error;
  }
}

/**
 * Transform parse.bot listing to our schema
 */
function transformListing(pbListing: ParseBotListing): PropertyListing {
  return {
    property_id: generatePropertyId(pbListing.property_url),
    property_title: pbListing.property_title,
    property_url: pbListing.property_url,
    property_type: pbListing.property_type,
    transaction_type: pbListing.transaction_type || 'sale',
    community: pbListing.community,
    project_name: pbListing.project_name || pbListing.project,
    bedrooms: pbListing.number_of_bedrooms,
    bathrooms: pbListing.number_of_bathrooms,
    built_up_area_sqft: pbListing.built_up_area_sqft,
    plot_area_sqft: pbListing.plot_area_sqft,
    price_aed: pbListing.price_aed,
    price_currency: pbListing.price_currency || 'AED',
    payment_plan_available: pbListing.payment_plan_available,
    handover_status: pbListing.handover_status,
    developer_name: pbListing.developer_name,
    furnishing_status: pbListing.furnishing_status,
    key_features: pbListing.key_features || [],
    agent_name: pbListing.agent_name,
    agent_phone: pbListing.agent_phone,
    image_urls: pbListing.image_urls || [],
    breadcrumb_location: pbListing.breadcrumb_location_hierarchy
  };
}

/**
 * Upsert listings into Supabase
 */
export async function upsertListings(listings: PropertyListing[]): Promise<{ success: number; errors: number }> {
  const supabase = getSupabaseClient();
  let success = 0;
  let errors = 0;

  console.log(`[Listings] Upserting ${listings.length} listings to Supabase...`);

  for (const listing of listings) {
    try {
      const { error } = await supabase
        .from('property_listings')
        .upsert({
          property_id: listing.property_id,
          property_title: listing.property_title,
          property_url: listing.property_url,
          property_type: listing.property_type,
          transaction_type: listing.transaction_type,
          community: listing.community,
          project_name: listing.project_name,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          built_up_area_sqft: listing.built_up_area_sqft,
          plot_area_sqft: listing.plot_area_sqft,
          price_aed: listing.price_aed,
          price_currency: listing.price_currency,
          payment_plan_available: listing.payment_plan_available,
          handover_status: listing.handover_status,
          developer_name: listing.developer_name,
          furnishing_status: listing.furnishing_status,
          key_features: listing.key_features,
          agent_name: listing.agent_name,
          agent_phone: listing.agent_phone,
          image_urls: listing.image_urls,
          breadcrumb_location: listing.breadcrumb_location,
          raw_data: listing,
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'property_id'
        });

      if (error) {
        console.error(`[Listings] Error upserting listing ${listing.property_id}:`, error);
        errors++;
      } else {
        success++;
      }
    } catch (e: any) {
      console.error(`[Listings] Exception upserting listing:`, e.message);
      errors++;
    }
  }

  console.log(`[Listings] Upsert complete: ${success} success, ${errors} errors`);
  return { success, errors };
}

/**
 * Sync listings from parse.bot to Supabase
 */
export async function syncListings(limit: number = 10): Promise<{ fetched: number; success: number; errors: number }> {
  try {
    const pbListings = await fetchFromParseBot(limit);
    const listings = pbListings.map(transformListing);
    const result = await upsertListings(listings);
    return { fetched: pbListings.length, ...result };
  } catch (error: any) {
    console.error("[Listings] Sync failed:", error.message);
    return { fetched: 0, success: 0, errors: 1 };
  }
}

/**
 * Search listings from Supabase with filters
 */
export async function searchListings(filters: SearchFilters): Promise<PropertyListing[]> {
  const supabase = getSupabaseClient();
  const limit = filters.limit || 5;

  console.log("[Listings] Searching with filters:", filters);

  try {
    // Use the RPC function for filtered search
    const { data, error } = await supabase.rpc('search_property_listings', {
      p_property_type: filters.property_type || null,
      p_min_bedrooms: filters.min_bedrooms || null,
      p_max_bedrooms: filters.max_bedrooms || null,
      p_min_price: filters.min_price || null,
      p_max_price: filters.max_price || null,
      p_community: filters.community || null,
      p_limit: limit
    });

    if (error) {
      console.error("[Listings] Search error:", error);
      // Fallback to direct query
      return await searchListingsDirect(filters);
    }

    console.log(`[Listings] Found ${data?.length || 0} matching listings`);
    return data || [];
  } catch (e: any) {
    console.error("[Listings] Search exception:", e.message);
    return await searchListingsDirect(filters);
  }
}

/**
 * Direct search fallback (if RPC function doesn't exist)
 */
async function searchListingsDirect(filters: SearchFilters): Promise<PropertyListing[]> {
  const supabase = getSupabaseClient();
  const limit = filters.limit || 5;

  let query = supabase
    .from('property_listings')
    .select('*')
    .order('synced_at', { ascending: false })
    .limit(limit);

  if (filters.property_type) {
    query = query.ilike('property_type', filters.property_type);
  }
  if (filters.min_bedrooms) {
    query = query.gte('bedrooms', filters.min_bedrooms);
  }
  if (filters.max_bedrooms) {
    query = query.lte('bedrooms', filters.max_bedrooms);
  }
  if (filters.min_price) {
    query = query.gte('price_aed', filters.min_price);
  }
  if (filters.max_price) {
    query = query.lte('price_aed', filters.max_price);
  }
  if (filters.community) {
    query = query.ilike('community', `%${filters.community}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[Listings] Direct search error:", error);
    return [];
  }

  return data || [];
}

/**
 * Get the latest N listings
 */
export async function getLatestListings(limit: number = 10): Promise<PropertyListing[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('property_listings')
    .select('*')
    .order('synced_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[Listings] Error getting latest listings:", error);
    return [];
  }

  return data || [];
}

/**
 * Format listing for AI agent context (concise format)
 */
export function formatListingForAgent(listing: PropertyListing): string {
  const parts = [];
  
  // Title and basic info
  parts.push(`📍 ${listing.property_title}`);
  
  // Property details
  const details = [];
  if (listing.bedrooms) details.push(`${listing.bedrooms} BR`);
  if (listing.bathrooms) details.push(`${listing.bathrooms} Bath`);
  if (listing.built_up_area_sqft) details.push(`${listing.built_up_area_sqft.toLocaleString()} sqft`);
  if (details.length) parts.push(`   ${details.join(' | ')}`);
  
  // Price
  if (listing.price_aed) {
    parts.push(`   💰 AED ${listing.price_aed.toLocaleString()}`);
  }
  
  // Location
  if (listing.community) {
    parts.push(`   📌 ${listing.community}${listing.project_name ? ` - ${listing.project_name}` : ''}`);
  }
  
  // Status
  const status = [];
  if (listing.handover_status) status.push(listing.handover_status);
  if (listing.furnishing_status) status.push(listing.furnishing_status);
  if (status.length) parts.push(`   🏷️ ${status.join(', ')}`);
  
  // Key features (first 3)
  if (listing.key_features && listing.key_features.length > 0) {
    const features = listing.key_features.slice(0, 3).join(', ');
    parts.push(`   ✨ ${features}`);
  }
  
  // URL
  parts.push(`   🔗 ${listing.property_url}`);
  
  // First image (for WhatsApp)
  if (listing.image_urls && listing.image_urls.length > 0) {
    parts.push(`   [IMAGE:${listing.image_urls[0]}]`);
  }

  return parts.join('\n');
}

/**
 * Format listing for WhatsApp message (with image marker)
 */
export function formatListingForWhatsApp(listing: PropertyListing): { text: string; imageUrl: string | null } {
  const parts = [];
  
  // Title
  parts.push(`🏠 *${listing.property_title}*`);
  parts.push('');
  
  // Details
  const details = [];
  if (listing.bedrooms) details.push(`🛏️ ${listing.bedrooms} Bedrooms`);
  if (listing.bathrooms) details.push(`🚿 ${listing.bathrooms} Bathrooms`);
  if (listing.built_up_area_sqft) details.push(`📐 ${listing.built_up_area_sqft.toLocaleString()} sqft`);
  if (details.length) parts.push(details.join('\n'));
  
  // Price
  if (listing.price_aed) {
    parts.push(`💰 *AED ${listing.price_aed.toLocaleString()}*`);
  }
  
  // Location
  if (listing.community) {
    parts.push(`📍 ${listing.community}${listing.project_name ? ` - ${listing.project_name}` : ''}`);
  }
  
  // Status
  if (listing.handover_status) {
    parts.push(`🏷️ ${listing.handover_status}`);
  }
  
  // Key features (first 3)
  if (listing.key_features && listing.key_features.length > 0) {
    const features = listing.key_features.slice(0, 3).join(' • ');
    parts.push(`✨ ${features}`);
  }
  
  // Link
  parts.push('');
  parts.push(`🔗 View details: ${listing.property_url}`);

  const imageUrl = listing.image_urls && listing.image_urls.length > 0 ? listing.image_urls[0] : null;

  return {
    text: parts.join('\n'),
    imageUrl
  };
}

/**
 * Format multiple listings as a summary
 */
export function formatListingsSummary(listings: PropertyListing[]): string {
  if (listings.length === 0) {
    return "No matching properties found in our current listings.";
  }

  const summaries = listings.map((listing, index) => {
    const parts = [];
    parts.push(`${index + 1}. ${listing.property_title}`);
    
    const details = [];
    if (listing.bedrooms) details.push(`${listing.bedrooms}BR`);
    if (listing.price_aed) details.push(`AED ${(listing.price_aed / 1000000).toFixed(1)}M`);
    if (listing.community) details.push(listing.community);
    
    if (details.length) parts.push(`   ${details.join(' • ')}`);
    parts.push(`   ${listing.property_url}`);
    
    if (listing.image_urls && listing.image_urls.length > 0) {
      parts.push(`   [IMAGE:${listing.image_urls[0]}]`);
    }
    
    return parts.join('\n');
  });

  return `Found ${listings.length} matching properties:\n\n${summaries.join('\n\n')}`;
}
