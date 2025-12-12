import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { convertImagesToJpeg } from './image-format-helper.js';

// Load Environment
const envPath = path.resolve('auro-rag-mcp', '.env');
const rootEnvPath = path.resolve('.env');
const localEnvPath = path.resolve('.env.local');

if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
if (fs.existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath });
if (fs.existsSync(localEnvPath)) dotenv.config({ path: localEnvPath });

// Configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const parseKey = process.env.PARSE_API_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

if (!parseKey) {
    console.error('❌ Missing PARSE_API_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse.bot API Configuration
const PARSE_SCRAPER_ID = '98f4861a-6e6b-41ed-8efe-f9ff96ee8fe8';
const PARSE_ENDPOINT = `https://api.parse.bot/scraper/${PARSE_SCRAPER_ID}/fetch_listing_page`;

// URLs to scrape for property listings
const LISTING_URLS = [
    'https://www.providentestate.com/buy/properties-for-sale/',
    'https://www.providentestate.com/buy/properties-for-sale/dubai-marina/',
    'https://www.providentestate.com/buy/properties-for-sale/downtown-dubai/',
    'https://www.providentestate.com/buy/properties-for-sale/jumeirah-beach-residence/',
    'https://www.providentestate.com/buy/properties-for-sale/business-bay/',
];

/**
 * Fetch listing data from Parse.bot
 */
async function fetchFromParse(url) {
    console.log(`\n📡 Fetching: ${url}`);

    try {
        const resp = await fetch(PARSE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': parseKey
            },
            body: JSON.stringify({ page_url: url })
        });

        if (!resp.ok) {
            console.error(`❌ Parse Error ${resp.status}:`, await resp.text());
            return null;
        }

        const data = await resp.json();
        console.log(`✅ Received data (${JSON.stringify(data).length} chars)`);
        return data;
    } catch (e) {
        console.error('❌ Parse Exception:', e.message);
        return null;
    }
}

/**
 * Extract property details from Parse.bot response
 * Parse.bot returns html_content with nested JSON containing hits array
 */
function extractListings(parseData, sourceUrl) {
    const listings = [];

    try {
        let rawListings = [];

        // Parse.bot returns: { html_content: "{...JSON string...}" }
        if (parseData.html_content) {
            try {
                const htmlData = JSON.parse(parseData.html_content);

                // The parsed JSON has structure: { result: { serverData: { data: { hits: [...] } } } }
                if (htmlData.result?.serverData?.data?.hits) {
                    rawListings = htmlData.result.serverData.data.hits;
                }
            } catch (e) {
                console.error('⚠️  Error parsing html_content:', e.message);
            }
        }

        console.log(`📋 Found ${rawListings.length} raw listings in Parse.bot response`);

        // Process each raw listing
        for (const raw of rawListings) {
            try {
                // Extract images from the images array
                const imageUrls = [];
                if (Array.isArray(raw.images)) {
                    raw.images.forEach(img => {
                        // Get the highest quality image (696x520 or 464x312)
                        if (img['696x520']) {
                            imageUrls.push(img['696x520']);
                        } else if (img['464x312']) {
                            imageUrls.push(img['464x312']);
                        } else if (img['340x252']) {
                            imageUrls.push(img['340x252']);
                        }
                    });
                }

                // Convert WebP images to JPEG for WhatsApp compatibility
                const whatsappCompatibleImages = convertImagesToJpeg(imageUrls);
                console.log(`  📸 Converted ${imageUrls.length} images (${whatsappCompatibleImages.length} compatible)`);

                // Extract agent info
                const agent = raw.link_to_employee || raw.crm_negotiator_id?.[0] || {};

                // Build full address
                const addressParts = [];
                if (raw.address_full) {
                    if (raw.address_full.address1) addressParts.push(raw.address_full.address1);
                    if (raw.address_full.address2) addressParts.push(raw.address_full.address2);
                    if (raw.address_full.address3) addressParts.push(raw.address_full.address3);
                }

                const listing = {
                    external_id: raw.crm_id || raw.id?.toString() || `parse-${Date.now()}-${Math.random()}`,
                    title: raw.description || raw.slug?.replace(/-/g, ' ') || 'Property for Sale',
                    description: raw.long_description || raw.description || '',
                    property_type: extractPropertyType(raw),
                    offering_type: raw.search_type === 'sales' ? 'sale' : 'rent',
                    community: raw.address_full?.area || raw.address_full?.address3 || extractCommunity(raw, sourceUrl),
                    sub_community: raw.address_full?.address1 || raw.address_full?.address2 || null,
                    address: addressParts.join(', ') || raw.display_address || null,
                    bedrooms: raw.bedroom || 0,
                    bathrooms: raw.bathroom || 0,
                    area_sqft: parseFloat(raw.floorarea_min || raw.floorarea_max || 0),
                    price: raw.price || 0,
                    price_per_sqft: raw.floorarea_min && raw.price ? (raw.price / raw.floorarea_min) : null,
                    images: whatsappCompatibleImages, // Use converted images for WhatsApp compatibility
                    agent_name: agent.name || 'Provident Estate',
                    agent_phone: agent.phone || null,
                    agent_company: 'Provident Estate',
                    source: 'parsebot',
                    source_url: `https://providentestate.com/${raw.slug}` || sourceUrl,
                    status: 'active',
                    latitude: raw.latitude || null,
                    longitude: raw.longitude || null
                };

                // Only add if we have minimum required fields
                if (listing.title && listing.price && listing.price > 0) {
                    listings.push(listing);
                    console.log(`  ✓ ${listing.title} - AED ${listing.price.toLocaleString()}`);
                }
            } catch (e) {
                console.error('⚠️  Error processing listing:', e.message);
            }
        }
    } catch (e) {
        console.error('⚠️  Error extracting listings:', e.message);
    }

    return listings;
}

/**
 * Helper functions to extract and normalize data
 */
function extractPropertyType(raw) {
    const type = (raw.property_type || raw.type || '').toLowerCase();
    if (type.includes('villa')) return 'villa';
    if (type.includes('penthouse')) return 'penthouse';
    if (type.includes('townhouse')) return 'townhouse';
    if (type.includes('studio')) return 'studio';
    return 'apartment'; // default
}

function extractOfferingType(raw) {
    const offering = (raw.offering_type || raw.listing_type || raw.for || '').toLowerCase();
    if (offering.includes('rent')) return 'rent';
    return 'sale'; // default
}

function extractCommunity(raw, sourceUrl) {
    // Try to extract from data first
    if (raw.community) return raw.community;
    if (raw.area) return raw.area;
    if (raw.location) return raw.location;

    // Extract from URL
    const url = sourceUrl.toLowerCase();
    if (url.includes('dubai-marina')) return 'Dubai Marina';
    if (url.includes('downtown-dubai')) return 'Downtown Dubai';
    if (url.includes('jumeirah-beach-residence') || url.includes('jbr')) return 'Jumeirah Beach Residence';
    if (url.includes('business-bay')) return 'Business Bay';
    if (url.includes('palm-jumeirah')) return 'Palm Jumeirah';

    return null;
}

function extractNumber(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const match = value.match(/\d+/);
        return match ? parseInt(match[0]) : null;
    }
    return null;
}

function extractPrice(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        // Remove currency symbols and commas
        const cleaned = value.replace(/[^\d.]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    }
    return null;
}

function extractImages(raw) {
    const images = [];

    if (Array.isArray(raw.images)) {
        images.push(...raw.images);
    } else if (Array.isArray(raw.photos)) {
        images.push(...raw.photos);
    } else if (raw.image) {
        images.push(raw.image);
    } else if (raw.photo) {
        images.push(raw.photo);
    } else if (raw.thumbnail) {
        images.push(raw.thumbnail);
    }

    return images.filter(img => typeof img === 'string' && img.startsWith('http'));
}

/**
 * Insert listings into property_listings table
 */
async function insertListings(listings) {
    if (listings.length === 0) {
        console.log('⚠️  No listings to insert');
        return;
    }

    console.log(`\n📝 Inserting ${listings.length} listings into database...`);

    for (const listing of listings) {
        try {
            const { data, error } = await supabase
                .from('property_listings')
                .upsert({
                    external_id: listing.external_id,
                    title: listing.title,
                    description: listing.description,
                    property_type: listing.property_type,
                    offering_type: listing.offering_type,
                    community: listing.community,
                    sub_community: listing.sub_community,
                    address: listing.address,
                    bedrooms: listing.bedrooms,
                    bathrooms: listing.bathrooms,
                    area_sqft: listing.area_sqft,
                    price: listing.price,
                    images: listing.images,
                    agent_name: listing.agent_name,
                    agent_phone: listing.agent_phone,
                    agent_company: listing.agent_company,
                    source: listing.source,
                    source_url: listing.source_url,
                    status: listing.status,
                    synced_at: new Date().toISOString()
                }, {
                    onConflict: 'external_id'
                });

            if (error) {
                console.error(`❌ Error inserting "${listing.title}":`, error.message);
            } else {
                console.log(`✅ Inserted: ${listing.title} - AED ${listing.price?.toLocaleString()}`);
            }
        } catch (e) {
            console.error(`❌ Exception inserting listing:`, e.message);
        }
    }
}

/**
 * Main function
 */
async function main() {
    console.log('🚀 Parse.bot Property Listings Sync');
    console.log('═'.repeat(50));
    console.log(`Supabase URL: ${supabaseUrl}`);
    console.log(`Parse API Key: ${parseKey ? '✓ Found' : '✗ Missing'}`);
    console.log(`URLs to scrape: ${LISTING_URLS.length}`);
    console.log('═'.repeat(50));

    let totalListings = 0;

    for (const url of LISTING_URLS) {
        const parseData = await fetchFromParse(url);

        if (!parseData) {
            console.log('⚠️  Skipping due to fetch error');
            continue;
        }

        // Save raw response for debugging
        const debugFile = `parse_response_${Date.now()}.json`;
        fs.writeFileSync(debugFile, JSON.stringify(parseData, null, 2));
        console.log(`💾 Saved raw response to: ${debugFile}`);

        const listings = extractListings(parseData, url);
        console.log(`📋 Extracted ${listings.length} listings from response`);

        await insertListings(listings);
        totalListings += listings.length;

        // Rate limiting - wait 2 seconds between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n' + '═'.repeat(50));
    console.log(`✅ Sync Complete! Total listings processed: ${totalListings}`);
    console.log('═'.repeat(50));

    // Verify insertion
    const { data: count } = await supabase
        .from('property_listings')
        .select('id', { count: 'exact', head: true });

    console.log(`\n📊 Total listings in database: ${count || 0}`);
}

main().catch(console.error);
