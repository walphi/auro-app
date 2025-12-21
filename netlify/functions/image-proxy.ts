import { Handler } from "@netlify/functions";
import axios from "axios";
import { getListingById, getListingImageUrl } from "./listings-helper";

const handler: Handler = async (event) => {
    let src: string | undefined;
    try {
        const { listingId } = event.queryStringParameters || {};
        let indexStr = event.queryStringParameters?.index || "0";
        src = event.queryStringParameters?.src;

        // Clean up index (remove .jpg if present from redirect)
        const index = parseInt(indexStr.replace('.jpg', ''));

        // If listingId is provided, resolve it from DB
        if (listingId) {
            console.log(`[Image Proxy] Fetching listing ${listingId}, index ${index}`);
            const listing = await getListingById(listingId);

            if (listing) {
                // If index > 0, try to pick from images array
                if (index > 0 && Array.isArray(listing.images) && listing.images[index]) {
                    const candidate = listing.images[index]?.url || listing.images[index];
                    if (typeof candidate === 'string') {
                        src = candidate;
                    }
                }

                // If not found or index 0, use the primary image helper
                if (!src) {
                    src = getListingImageUrl(listing) || undefined;
                }
            }
        }

        if (!src) {
            console.error("[Image Proxy] No source URL found");
            return { statusCode: 404, body: "Not Found" };
        }

        // Final check: resolve the URL just in case it's still a blocked CloudFront one
        // (getListingImageUrl already does this, but if we picked from images[] we need it)
        if (src.includes('cloudfront.net')) {
            // We use the same logic as in listings-helper to resolve
            src = src.replace('d3h330vgpwpjr8.cloudfront.net/x/', 'ggfx-providentestate.s3.eu-west-2.amazonaws.com/i/')
                .replace(/\/\d+x\d+\//, '/')
                .replace(/\.webp$/i, '.jpg');
        }

        console.log(`[Image Proxy] Fetching upstream: ${src}`);

        const response = await axios.get(src, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Referer': 'https://providentestate.com/'
            }
        });

        const contentType = response.headers['content-type'] || 'image/jpeg';
        console.log(`[Image Proxy] Upstream responded with ${response.status}, type ${contentType}`);

        const filename = `${listingId || 'image'}-${index}.jpg`;

        return {
            statusCode: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `inline; filename="${filename}"`,
                "Cache-Control": "public, max-age=86400",
                "Access-Control-Allow-Origin": "*"
            },
            body: Buffer.from(response.data).toString('base64'),
            isBase64Encoded: true
        };

    } catch (error: any) {
        console.error("[Image Proxy] Error fetching upstream:", src, error.message);
        return {
            statusCode: 502,
            body: "Error fetching image from upstream source."
        };
    }
};

export { handler };
