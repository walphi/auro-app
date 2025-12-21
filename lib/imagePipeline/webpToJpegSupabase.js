import sharp from 'sharp';
import axios from 'axios';
import { supabase } from '../supabaseClient.js';

/**
 * Fetches a WebP image, converts it to JPEG, and uploads it to Supabase Storage.
 * 
 * @param {string} webpUrl - The URL of the WebP image.
 * @param {string} listingId - The UUID or ID of the property listing for the filename.
 * @returns {Promise<string>} - The public URL of the uploaded JPEG.
 */
export async function webpToJpegAndUpload(webpUrl, listingId) {
    if (!webpUrl) {
        throw new Error('No WebP URL provided');
    }

    try {
        console.log(`[ImagePipeline] Processing image: ${webpUrl.substring(0, 50)}...`);

        // 1. Fetch the image using axios
        const response = await axios.get(webpUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Referer': 'https://www.providentestate.com/'
            }
        });

        const buffer = Buffer.from(response.data);

        // 2. Convert to JPEG using Sharp
        const jpegBuffer = await sharp(buffer)
            .jpeg({ quality: 80, mozjpeg: true })
            .toBuffer();

        // 3. Upload to Supabase Storage
        const fileName = `${listingId}.jpg`;
        const filePath = `property-images/${fileName}`;

        const { data, error } = await supabase.storage
            .from('property-images') // Make sure this bucket exists and is public
            .upload(filePath, jpegBuffer, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (error) {
            throw new Error(`Supabase Storage Upload Error: ${error.message}`);
        }

        // 4. Get the public URL
        const { data: publicUrlData } = supabase.storage
            .from('property-images')
            .getPublicUrl(filePath);

        const publicUrl = publicUrlData.publicUrl;
        console.log(`[ImagePipeline] Successfully uploaded JPEG: ${publicUrl}`);

        return publicUrl;
    } catch (error) {
        console.error(`[ImagePipeline] Error in webpToJpegAndUpload:`, error.message);
        throw error;
    }
}
