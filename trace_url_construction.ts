
import { getListingById } from './netlify/functions/listings-helper';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Mock process.env for the helper
process.env.VITE_SUPABASE_URL = process.env.SUPABASE_URL;
process.env.VITE_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const listingId = 'd3b1b258-14c0-4171-a4cf-2615fbea32db'; // The one with 'Feature' image

async function trace() {
    console.log(`Tracing for ${listingId}...`);
    const { data: listing, error } = await getListingById(listingId);
    if (error || !listing) {
        console.error("Listing not found or error:", error);
        return;
    }

    const rawImage = listing.images[0];
    console.log("Raw Image from DB:", rawImage);

    let src = rawImage;
    if (src.includes('cloudfront.net') && src.includes('/x/')) {
        console.log("Detected CF pattern.");
        if (src.includes('amazonaws.com')) {
            console.log("Detected S3 wrap. Rewriting...");
            src = src.replace(/https?:\/\/d3h330vgpwpjr8\.cloudfront\.net\/x\//i, 'https://')
                .replace(/\/\d+x\d+\//, '/')
                .replace(/\.webp$/i, '.jpg');
        } else {
            console.log("Detected direct CF. Keeping original.");
        }
    }
    console.log("Final Src:", src);
}

trace();
