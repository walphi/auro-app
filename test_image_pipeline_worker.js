import { webpToJpegAndUpload } from './lib/imagePipeline/webpToJpegSupabase.js';
import { supabase } from './lib/supabaseClient.js';

async function test() {
    console.log('--- Testing Image Pipeline ---');

    // A sample WebP URL from Provident (found by searching their site structure)
    // If this URL is dead, replace with any valid WebP URL
    const sampleWebp = 'https://photos.providentestate.com/1/696/520/images/properties/11316/1733306871_P-11316-1.webp';
    const testId = 'test-' + Date.now();

    try {
        console.log(`Starting test for listing: ${testId}`);
        const jpegUrl = await webpToJpegAndUpload(sampleWebp, testId);

        console.log('SUCCESS!');
        console.log(`Resulting JPEG URL: ${jpegUrl}`);

        // Clean up: optional, but good for testing
        // const { error: deleteError } = await supabase.storage
        //     .from('property-images')
        //     .remove([`property-images/${testId}.jpg`]);
        // if (deleteError) console.error('Cleanup error:', deleteError.message);

    } catch (e) {
        console.error('TEST FAILED');
        console.error(e);

        if (e.message.includes('bucket not found') || e.message.includes('Bucket not found')) {
            console.log('\n💡 It seems the "property-images" bucket does not exist.');
            console.log('Please create a PUBLIC bucket named "property-images" in your Supabase project.');
        }
    }
}

test();
