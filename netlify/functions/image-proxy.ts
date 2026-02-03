import { Handler } from "@netlify/functions";
import axios from "axios";
import { getListingById, getListingImageUrl } from "./listings-helper";

const handler: Handler = async (event) => {
    let src: string | undefined;
    try {
        let { listingId, index: indexStr } = event.queryStringParameters || {};
        src = event.queryStringParameters?.src;

        // Robust Path-based extraction (handles /property-image/ID/INDEX.jpg)
        const originalPath = event.headers['x-nf-original-path'] || event.headers['x-rewrite-original-path'] || event.path;
        console.log(`[Image Proxy] Requested Path: ${originalPath} (event.path: ${event.path})`);

        const pathParts = originalPath.split('/').filter(p => !!p);
        const piIndex = pathParts.indexOf('property-image');
        if (piIndex !== -1 && pathParts.length > piIndex + 1) {
            listingId = listingId || pathParts[piIndex + 1];
            indexStr = indexStr || pathParts[piIndex + 2];
        }

        console.log(`[Image Proxy] Resolved Params: listingId=${listingId}, indexStr=${indexStr}, src=${src}`);

        // Clean up index (remove .jpg/.jpeg/.webp if present)
        const index = parseInt((indexStr || "0").replace(/\.(jpg|jpeg|webp)$/i, '')) || 0;

        // If listingId is provided, resolve it from DB
        if (listingId) {
            console.log(`[Image Proxy] Fetching listing ${listingId}, index ${index}`);
            const listing = await getListingById(listingId);

            if (listing) {
                if (index > 0) {
                    // Gallery images
                    const images = Array.isArray(listing.images) ? listing.images : [];
                    if (index < images.length) {
                        const candidate = images[index]?.url || images[index];
                        if (typeof candidate === 'string') {
                            src = candidate;
                        }
                    }

                    if (!src) {
                        console.log(`[Image Proxy] Index ${index} out of bounds for listing ${listingId}`);
                        return { statusCode: 404, body: "Image index out of bounds" };
                    }
                } else {
                    // Hero image (Index 0)
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

        let response;
        const fetchImage = async (url: string) => {
            return await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 8000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'Referer': 'https://providentestate.com/'
                }
            });
        };

        try {
            response = await fetchImage(src);
        } catch (error: any) {
            console.warn(`[Image Proxy] Primary fetch failed: ${src} (${error.message})`);
            const fallbacks: string[] = [];
            if (src.includes('s3.eu-west-2.amazonaws.com') || src.includes('providentestate')) {
                if (src.endsWith('.jpg')) fallbacks.push(src.replace(/\.jpg$/, '.JPG'), src.replace(/\.jpg$/, '.webp'));
                else if (src.endsWith('.JPG')) fallbacks.push(src.replace(/\.JPG$/, '.jpg'), src.replace(/\.JPG$/, '.webp'));
                else if (src.endsWith('.webp')) fallbacks.push(src.replace(/\.webp$/, '.jpg'), src.replace(/\.webp$/, '.JPG'));
            }

            let success = false;
            for (const fallbackSrc of fallbacks) {
                try {
                    console.log(`[Image Proxy] Retrying with fallback: ${fallbackSrc}`);
                    response = await fetchImage(fallbackSrc);
                    src = fallbackSrc;
                    success = true;
                    break;
                } catch (e) { }
            }
            if (!success) throw error;
        }

        if (!response) {
            throw new Error("Failed to capture response during fetch");
        }

        const upstreamContentType = response.headers['content-type'];
        const contentType = (originalPath.endsWith('.jpg') || originalPath.endsWith('.jpeg'))
            ? 'image/jpeg'
            : (upstreamContentType?.startsWith('image/') ? upstreamContentType : 'image/jpeg');

        console.log(`[Image Proxy] Success. Upstream Type: ${upstreamContentType}, Final Type: ${contentType}`);

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
