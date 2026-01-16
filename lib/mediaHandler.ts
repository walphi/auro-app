import axios from 'axios';
import { supabase } from './supabase';

/**
 * Downloads a media file from Twilio and uploads it to Supabase storage.
 * @param twilioUrl The URL of the media from Twilio.
 * @param agentId The ID of the agent for organizing storage.
 * @param fileName An optional specific filename.
 * @returns The public URL of the stored file.
 */
export async function downloadAndStoreMedia(twilioUrl: string, agentId: string, fileName?: string): Promise<string | null> {
    try {
        console.log(`[MediaHandler] Processing media for agent: ${agentId}`, { twilioUrl });

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;

        if (!accountSid || !authToken) {
            throw new Error("Missing Twilio credentials");
        }

        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

        // 1. Fetch from Twilio (handles redirects)
        const response = await axios.get(twilioUrl, {
            headers: { Authorization: `Basic ${auth}` },
            responseType: 'arraybuffer'
        });

        const buffer = Buffer.from(response.data);
        const contentType = response.headers['content-type'] || 'image/jpeg';
        const extension = contentType.split('/')[1] || 'jpg';

        const actualFileName = fileName || `inspiration_${Date.now()}.${extension}`;
        const filePath = `agents/${agentId}/${actualFileName}`;

        // 2. Upload to Supabase Storage
        // Using "property-images" bucket as it's confirmed to exist and be public
        const { data, error: uploadError } = await supabase.storage
            .from('property-images')
            .upload(filePath, buffer, {
                contentType,
                upsert: true
            });

        if (uploadError) {
            console.error(`[MediaHandler] Upload error:`, uploadError);
            throw uploadError;
        }

        // 3. Get Public URL
        const { data: publicUrlData } = supabase.storage
            .from('property-images')
            .getPublicUrl(filePath);

        console.log(`[MediaHandler] Successfully stored: ${publicUrlData.publicUrl}`);
        return publicUrlData.publicUrl;

    } catch (error: any) {
        console.error(`[MediaHandler] Error in downloadAndStoreMedia:`, error.message);
        return null;
    }
}
