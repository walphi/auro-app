# WhatsApp Image Format Fix

## Problem
WhatsApp via Twilio has **limited support for WebP images**. Many property listing images from Parse.bot are in WebP format, which causes them to fail when sent via WhatsApp.

### Supported Formats
✅ **JPEG** (.jpg, .jpeg)  
✅ **PNG** (.png)  
⚠️ **WebP** (.webp) - Limited support, often rejected

## Solution
We've implemented a comprehensive image format conversion system that automatically converts WebP images to JPEG format for WhatsApp compatibility.

## Implementation

### 1. Image Format Helper (`image-format-helper.ts` / `image-format-helper.js`)
A utility module that converts WebP image URLs to JPEG format. Supports multiple CDN patterns:

- **Cloudinary**: Replaces `/f_webp/` with `/f_jpg/`
- **Imgix**: Uses `fm=jpg` parameter
- **Generic CDNs**: Adds `format=jpeg` parameter
- **Simple URLs**: Replaces `.webp` extension with `.jpg`

**Key Functions:**
- `convertToJpeg(imageUrl)` - Converts a single image URL
- `convertImagesToJpeg(images)` - Converts an array of image URLs
- `prepareImageForWhatsApp(imageUrl)` - Validates and prepares an image for WhatsApp
- `isWhatsAppCompatible(imageUrl)` - Checks if an image is already compatible

### 2. Updated Listings Helper (`netlify/functions/listings-helper.ts`)
The `formatListingsResponse()` function now:
1. Converts all property images to JPEG format
2. Validates images for WhatsApp compatibility
3. Logs conversion details for debugging

```typescript
// Convert images to JPEG format for WhatsApp compatibility
const convertedImages = convertImagesToJpeg(listing.images);
if (convertedImages.length > 0) {
    const whatsappImage = prepareImageForWhatsApp(convertedImages[0]);
    if (whatsappImage) {
        images.push(whatsappImage);
    }
}
```

### 3. Updated Sync Script (`sync_parsebot_listings.js`)
The Parse.bot sync script now:
1. Extracts images from Parse.bot API response
2. Converts all WebP images to JPEG format
3. Stores only WhatsApp-compatible images in the database

```javascript
// Convert WebP images to JPEG for WhatsApp compatibility
const whatsappCompatibleImages = convertImagesToJpeg(imageUrls);
```

### 4. Migration Script (`convert_images_to_jpeg.js`)
A one-time migration script to convert existing WebP images in the database.

## Usage

### For New Listings
Simply run the sync script as usual. All images will be automatically converted:

```bash
node sync_parsebot_listings.js
```

### For Existing Listings
Run the migration script to convert existing images:

```bash
node convert_images_to_jpeg.js
```

This will:
- Fetch all active property listings
- Identify listings with WebP images
- Convert WebP URLs to JPEG format
- Update the database with converted URLs
- Provide detailed progress and statistics

## How It Works

### URL Conversion Examples

**Before:**
```
https://cdn.example.com/property/image.webp
```

**After:**
```
https://cdn.example.com/property/image.jpg
```

**With CDN Parameters:**
```
Before: https://cdn.example.com/image.webp?w=800
After:  https://cdn.example.com/image.jpg?w=800&format=jpeg
```

### Cloudinary Example
```
Before: https://res.cloudinary.com/demo/image/upload/f_webp/sample.webp
After:  https://res.cloudinary.com/demo/image/upload/f_jpg/sample.jpg
```

### Imgix Example
```
Before: https://example.imgix.net/photo.webp?w=800&fm=webp
After:  https://example.imgix.net/photo.jpg?w=800&fm=jpg&q=85
```

## Testing

### Verify Conversion
After running the migration, check the database:

```sql
SELECT 
    title, 
    images 
FROM property_listings 
WHERE status = 'active' 
LIMIT 5;
```

All image URLs should end with `.jpg`, `.jpeg`, or `.png` (not `.webp`).

### Test WhatsApp Delivery
1. Send a property search query via WhatsApp
2. Verify that images are delivered successfully
3. Check the Netlify function logs for conversion messages:
   ```
   [Listings] Converted image for WhatsApp: https://...
   ```

## Monitoring

The system logs all image conversions:

```
[Listings] Converted image for WhatsApp: https://cdn.example.com/image.jpg...
```

If you see errors, check:
1. The original image URL format
2. CDN support for format conversion
3. Network connectivity to the CDN

## Future Improvements

1. **Fallback to Image Proxy**: If CDN doesn't support format conversion, use an image proxy service
2. **Cache Converted URLs**: Store converted URLs to avoid repeated conversions
3. **Support More CDNs**: Add support for additional CDN URL patterns
4. **Image Validation**: Verify that converted URLs actually return valid images

## Troubleshooting

### Images Still Not Sending
1. Check if the CDN supports format conversion via URL parameters
2. Verify the converted URL manually in a browser
3. Check Twilio/WhatsApp logs for specific error messages
4. Consider using an image proxy service for problematic CDNs

### Conversion Not Working
1. Check the image URL format in the database
2. Verify the `image-format-helper` is imported correctly
3. Check function logs for conversion errors
4. Test the conversion function directly with sample URLs

## Related Files
- `netlify/functions/image-format-helper.ts` - TypeScript image converter
- `image-format-helper.js` - JavaScript image converter
- `netlify/functions/listings-helper.ts` - Listings formatter with image conversion
- `sync_parsebot_listings.js` - Sync script with image conversion
- `convert_images_to_jpeg.js` - Migration script for existing images
- `netlify/functions/whatsapp.ts` - WhatsApp handler (uses converted images)

## Notes
- The conversion is URL-based and doesn't modify the actual image files
- CDNs typically support format conversion via URL parameters
- If a CDN doesn't support conversion, the URL will have `?format=jpeg` appended
- The system gracefully handles images that are already in JPEG/PNG format
