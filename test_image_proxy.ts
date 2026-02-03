
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    try {
        // 1. Get a listing that definitely has images
        console.log('Fetching a listing with images...');
        const { data: listings, error } = await supabase
            .from('property_listings')
            .select('id, title, images')
            .not('images', 'is', null)
            .limit(1);

        if (error || !listings || !listings.length) {
            console.error('No listings found', error);
            return;
        }

        const listingId = listings[0].id;
        // Construct the pretty URL that Twilio sees
        const testUrl = `https://auro-app.netlify.app/property-image/${listingId}/0.jpg`;

        console.log(`\nTesting URL: ${testUrl}`);
        console.log(`Title: ${listings[0].title}`);

        // 2. GET request to check full response
        const startTime = Date.now();
        const response = await axios.get(testUrl, {
            maxRedirects: 0,
            validateStatus: (status) => true,
            responseType: 'arraybuffer' // To correctly handle binary data
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
            console.log(`Byte size: ${response.data.length}`);
        } else {
            console.log(`\nFAILURE: Response is not a valid image.`);
            if (response.data && response.data.length > 0) {
                const bodyStr = Buffer.from(response.data).toString('utf-8');
                if (bodyStr.includes('<html') || bodyStr.includes('<!DOCTYPE')) {
                    console.log(`Body contains HTML! Snippet:\n${bodyStr.substring(0, 500)}`);
                } else {
                    console.log(`Body text: ${bodyStr.substring(0, 200)}`);
                }
            }
        }
    } catch (e: any) {
        console.error('Error during test:', e.message);
    }
}

test();
