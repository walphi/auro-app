
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    try {
        // 1. Get a listing
        const { data: listings, error } = await supabase.from('property_listings').select('id, title').limit(1);
        if (error || !listings.length) {
            console.error('No listings found', error);
            return;
        }
        const listingId = listings[0].id;
        const testUrl = `https://auro-app.netlify.app/property-image/${listingId}/0.jpg`;

        console.log(`Testing URL: ${testUrl}`);
        console.log(`Title: ${listings[0].title}`);

        // 2. Head request to check headers
        const startTime = Date.now();
        const response = await axios.get(testUrl, {
            maxRedirects: 0, // We want to see if it redirects
            validateStatus: (status) => true // Don't throw on non-200
        });
        const duration = Date.now() - startTime;

        console.log(`\n--- Results ---`);
        console.log(`Status: ${response.status}`);
        console.log(`Duration: ${duration}ms`);
        console.log(`Content-Type: ${response.headers['content-type']}`);
        console.log(`Content-Length: ${response.headers['content-length']}`);
        console.log(`Cache-Control: ${response.headers['cache-control']}`);
        console.log(`Location: ${response.headers['location'] || 'N/A'}`);

        if (response.status === 200 && response.headers['content-type']?.includes('image')) {
            console.log(`\nSUCCESS: Image served correctly.`);
        } else {
            console.log(`\nFAILURE: Response is not a valid image.`);
            if (response.data && typeof response.data === 'string' && response.data.includes('<html')) {
                console.log(`Body contains HTML! It's likely an error page.`);
            }
        }
    } catch (e) {
        console.error('Error during test:', e.message);
    }
}

test();
