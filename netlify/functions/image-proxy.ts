
import { Handler } from "@netlify/functions";
import axios from "axios";
import { getListingById, getListingImageUrl } from "./listings-helper";

const handler: Handler = async (event) => {
    let src: string | undefined;
    try {
        let { listingId, index: indexStr, src: querySrc } = event.queryStringParameters || {};
        src = querySrc;

        // Diagnostic Path Logging
        const xnf = event.headers['x-nf-original-path'];
        const xrew = event.headers['x-rewrite-original-path'];
        const originalPath = xnf || xrew || event.path || "";

        console.log(`[Image Proxy DIAG] Path Info:`, {
            path: event.path,
            originalPath,
            xnf,
            xrew,
            query: event.queryStringParameters
        });

        const pathParts = originalPath.split('/').filter(p => !!p);
        const piIndex = pathParts.indexOf('property-image');
        if (piIndex !== -1 && pathParts.length > piIndex + 1) {
            listingId = listingId || pathParts[piIndex + 1];
            indexStr = indexStr || pathParts[piIndex + 2];
            console.log(`[Image Proxy DIAG] Path Resolution:`, { listingId, indexStr });
        }

        // Clean up index (remove .jpg/.jpeg/.webp if present)
        const index = parseInt((indexStr || "0").replace(/\.(jpg|jpeg|webp)$/i, '')) || 0;

        let listingFound = false;

        let listingError: string | null = null;

        // If listingId is provided, resolve it from DB
        if (listingId && !src) {
            console.log(`[Image Proxy] Fetching from DB: ${listingId}, index ${index}`);
            const { data: listing, error } = await getListingById(listingId);
            listingError = error;

            if (listing) {
                listingFound = true;
                console.log(`[Image Proxy] Listing found: ${listing.title}`);
                if (index > 0) {
                    const images = Array.isArray(listing.images) ? listing.images : [];
                    console.log(`[Image Proxy] Gallery size: ${images.length}`);
                    if (index < images.length) {
                        const candidate = images[index]?.url || images[index];
                        if (typeof candidate === 'string') {
                            src = candidate;
                        }
                    }
                } else {
                    src = getListingImageUrl(listing) || undefined;
                    console.log(`[Image Proxy] getListingImageUrl result: ${src}`);
                }
            } else {
                console.warn(`[Image Proxy] Listing NOT FOUND in DB for ID: ${listingId}. Error: ${error}`);
            }
        }

        if (!src) {
            const diags = {
                listingId,
                index,
                src,
                listingFound,
                listingError,
                originalPath,
                env: {
                    hasUrl: !!(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
                    urlPrefix: (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").substring(0, 25),
                    hasKey: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)
                },
                timestamp: new Date().toISOString()
            };
            console.error("[Image Proxy] Resolution failure:", diags);
            return {
                statusCode: 404,
                headers: { "Content-Type": "application/json" } as Record<string, string>,
                body: JSON.stringify({ error: "No image source resolved", diags })
            };
        }

        // Final check: resolve the URL (redundant if using listings-helper but safe)
        if (src.includes('cloudfront.net') && src.includes('/x/')) {
            // Only rewrite if it's wrapping an S3 bucket URL (Double Domain Issue)
            if (src.includes('amazonaws.com')) {
                src = src.replace(/https?:\/\/d3h330vgpwpjr8\.cloudfront\.net\/x\//i, 'https://')
                    .replace(/\/\d+x\d+\//, '/')
                    .replace(/\.webp$/i, '.jpg');
            } else {
                console.log(`[Image Proxy] Detected direct CloudFront URL, not rewriting domain: ${src}`);
            }
        }

        console.log(`[Image Proxy] Fetching upstream: ${src}`);

        let response: any = null;
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
                    console.log(`[Image Proxy] Retrying fallback: ${fallbackSrc}`);
                    response = await fetchImage(fallbackSrc);
                    src = fallbackSrc;
                    success = true;
                    break;
                } catch (e) { }
            }
            if (!success) throw error;
        }

        if (!response || !response.headers) {
            throw new Error("Invalid upstream response");
        }

        const upstreamContentType = response.headers['content-type'];
        const contentType = (originalPath.endsWith('.jpg') || originalPath.endsWith('.jpeg'))
            ? 'image/jpeg'
            : (upstreamContentType?.startsWith('image/') ? upstreamContentType : 'image/jpeg');

        console.log(`[Image Proxy] Success. Final Type: ${contentType}, Size: ${response.data.length}`);

        return {
            statusCode: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `inline; filename="listing-${listingId || 'image'}-${index}.jpg"`,
                "Cache-Control": "public, max-age=86400",
                "Access-Control-Allow-Origin": "*",
                "X-Debug-Src": src
            } as Record<string, string>,
            body: Buffer.from(response.data).toString('base64'),
            isBase64Encoded: true
        };

    } catch (error: any) {
        console.error("[Image Proxy] Global Error:", src, error.message);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                error: error.message,
                src: src, // The URL we TRIED to fetch
                stack: error.stack
            })
        };
    }
};

export { handler };
