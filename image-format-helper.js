/**
 * Image Format Helper for WhatsApp Compatibility (JavaScript version)
 * 
 * WhatsApp via Twilio has limited support for WebP images.
 * This helper converts image URLs to WhatsApp-compatible formats (JPEG/PNG).
 */

/**
 * Convert a WebP image URL to JPEG format
 * Supports common CDN URL parameter patterns
 */
export function convertToJpeg(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string') {
        return imageUrl;
    }

    // Already JPEG or PNG - no conversion needed
    if (imageUrl.match(/\.(jpe?g|png)(\?|$)/i)) {
        return imageUrl;
    }

    // Check if it's a WebP image
    const isWebP = imageUrl.match(/\.webp(\?|$)/i);

    if (!isWebP) {
        // Not WebP, return as-is
        return imageUrl;
    }

    // Try to convert based on CDN patterns

    // Pattern 1: Cloudinary - replace format parameter
    if (imageUrl.includes('cloudinary.com')) {
        return imageUrl
            .replace(/\/f_webp\//gi, '/f_jpg/')
            .replace(/\.webp/gi, '.jpg')
            .replace(/format=webp/gi, 'format=jpg');
    }

    // Pattern 2: Imgix - use fm parameter
    if (imageUrl.includes('imgix.net')) {
        if (imageUrl.includes('fm=webp')) {
            return imageUrl.replace(/fm=webp/gi, 'fm=jpg');
        } else if (imageUrl.includes('?')) {
            return imageUrl + '&fm=jpg&q=85';
        } else {
            return imageUrl + '?fm=jpg&q=85';
        }
    }

    // Pattern 3: Generic CDN with format parameter
    if (imageUrl.includes('format=webp')) {
        return imageUrl.replace(/format=webp/gi, 'format=jpeg');
    }

    // Pattern 4: Simple extension replacement
    // Replace .webp with .jpg in the URL
    let convertedUrl = imageUrl.replace(/\.webp/gi, '.jpg');

    // If the URL has query parameters, try adding format conversion
    if (convertedUrl.includes('?')) {
        // Check if there's already a format parameter
        if (!convertedUrl.match(/[?&](format|fm|f)=/i)) {
            convertedUrl += '&format=jpeg';
        }
    } else {
        // Add format parameter
        convertedUrl += '?format=jpeg';
    }

    return convertedUrl;
}

/**
 * Convert an array of image URLs to JPEG format
 */
export function convertImagesToJpeg(images) {
    if (!Array.isArray(images)) {
        return [];
    }

    return images.map(img => convertToJpeg(img)).filter(img => img && img.length > 0);
}

/**
 * Check if an image URL is WhatsApp compatible
 */
export function isWhatsAppCompatible(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string') {
        return false;
    }

    // WhatsApp supports JPEG and PNG
    return imageUrl.match(/\.(jpe?g|png)(\?|$)/i) !== null;
}
