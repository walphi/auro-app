import { Handler } from "@netlify/functions";
import axios from "axios";
import { getListingById, getListingImageUrl } from "./listings-helper";

const handler: Handler = async (event) => {
    try {
        const { listingId, index } = event.queryStringParameters || {};
        let src = event.queryStringParameters?.src;

        // If listingId is provided, resolve it
        if (listingId) {
            console.log(`[Image Proxy] Resolving listing ${listingId}, index ${index || 0}`);
            const listing = await getListingById(listingId);
            if (listing) {
                // For now we just use the first image logic from helper
                // In future we can use index to pick from listing.images
                src = getListingImageUrl(listing) || undefined;
            }
        }

        if (!src) {
            console.error("[Image Proxy] No source URL found");
            return { statusCode: 404, body: "Not Found" };
        }

        console.log(`[Image Proxy] Fetching upstream: ${src}`);

        const response = await axios.get(src, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const contentType = response.headers['content-type'] || 'image/jpeg';
        console.log(`[Image Proxy] Upstream responded with ${response.status}, type ${contentType}`);

        return {
            statusCode: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=86400" // Cache for 24 hours
            },
            body: Buffer.from(response.data).toString('base64'),
            isBase64Encoded: true
        };

    } catch (error: any) {
        console.error("[Image Proxy] Error:", error.message);
        return {
            statusCode: error.response?.status || 500,
            body: `Error fetching image: ${error.message}`
        };
    }
};

export { handler };
