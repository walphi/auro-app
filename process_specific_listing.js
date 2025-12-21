import { webpToJpegAndUpload } from './lib/imagePipeline/webpToJpegSupabase.js';
import { supabase } from './lib/supabaseClient.js';

async function processCreekBeachListing() {
    const listingId = '023b2feb-48d3-4f4f-8310-d743b7c843aa';
    console.log(`--- Processing Creek Beach Listing: ${listingId} ---`);

    try {
        // 1. Fetch the listing from Supabase
        const { data: listing, error: fetchError } = await supabase
            .from('property_listings')
            .select('*')
            .eq('id', listingId)
            .single();

        if (fetchError || !listing) {
            console.error('❌ Could not find listing:', fetchError?.message || 'Listing not found');
            return;
        }

        console.log(`Found listing: ${listing.title}`);

        // 2. Get the first image URL
        const images = typeof listing.images === 'string' ? JSON.parse(listing.images) : listing.images;
        const firstImageUrl = images[0];

        if (!firstImageUrl) {
            console.error('❌ No images found for this listing');
            return;
        }

        console.log(`Processing image: ${firstImageUrl}`);

        // 3. Convert and Upload to Supabase Storage
        const jpegUrl = await webpToJpegAndUpload(firstImageUrl, listingId);

        // 4. Update the database record
        const { error: updateError } = await supabase
            .from('property_listings')
            .update({ image_url_jpeg: jpegUrl })
            .eq('id', listingId);

        if (updateError) {
            console.error('❌ Failed to update database:', updateError.message);
        } else {
            console.log('✅ SUCCESS!');
            console.log(`The listing is now updated with a reliable JPEG: ${jpegUrl}`);
        }

    } catch (e) {
        console.error('❌ Error in processing script:', e.message);
    }
}

processCreekBeachListing();
