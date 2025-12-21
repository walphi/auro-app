-- Migration to add image_url_jpeg column to property_listings table
ALTER TABLE public.property_listings 
ADD COLUMN IF NOT EXISTS image_url_jpeg TEXT;

-- Comment for clarity
COMMENT ON COLUMN public.property_listings.image_url_jpeg IS 'Public URL for the JPEG version of the listing image (converted from WebP for WhatsApp compatibility)';
