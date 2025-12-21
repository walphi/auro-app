-- SQL to create the property-images bucket and set up public access
-- Run this in Supabase SQL Editor if you don't use the dashboard

-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
SELECT 'property-images', 'property-images', true
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'property-images'
);

-- 2. Enable public read access to the bucket
-- Note: Replace with your specific policies if you have custom ones
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-images');

-- 3. Allow service role (used by the scraper) full access
CREATE POLICY "Service Role Full Access"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'property-images')
WITH CHECK (bucket_id = 'property-images');
