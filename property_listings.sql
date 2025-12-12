-- Property Listings Table for Provident Estate listings via parse.bot
-- Run this in Supabase SQL Editor

-- 1. Create property_listings table
CREATE TABLE IF NOT EXISTS public.property_listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id TEXT UNIQUE NOT NULL,
  property_title TEXT NOT NULL,
  property_url TEXT NOT NULL,
  property_type TEXT,
  transaction_type TEXT DEFAULT 'sale',
  community TEXT,
  project_name TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  built_up_area_sqft NUMERIC,
  plot_area_sqft NUMERIC,
  price_aed NUMERIC,
  price_currency TEXT DEFAULT 'AED',
  payment_plan_available TEXT,
  handover_status TEXT,
  developer_name TEXT,
  furnishing_status TEXT,
  key_features JSONB DEFAULT '[]'::jsonb,
  agent_name TEXT,
  agent_phone TEXT,
  image_urls JSONB DEFAULT '[]'::jsonb,
  breadcrumb_location TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_listings_property_type ON property_listings(property_type);
CREATE INDEX IF NOT EXISTS idx_listings_community ON property_listings(community);
CREATE INDEX IF NOT EXISTS idx_listings_price ON property_listings(price_aed);
CREATE INDEX IF NOT EXISTS idx_listings_bedrooms ON property_listings(bedrooms);
CREATE INDEX IF NOT EXISTS idx_listings_synced ON property_listings(synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_created ON property_listings(created_at DESC);

-- 3. Enable RLS
ALTER TABLE public.property_listings ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all read on property_listings" ON public.property_listings;
DROP POLICY IF EXISTS "Allow all write on property_listings" ON public.property_listings;

-- 5. Create permissive policies
CREATE POLICY "Allow all read on property_listings" ON public.property_listings FOR SELECT USING (true);
CREATE POLICY "Allow all write on property_listings" ON public.property_listings FOR ALL USING (true);

-- 6. Grant permissions
GRANT ALL ON public.property_listings TO authenticated;
GRANT ALL ON public.property_listings TO service_role;
GRANT ALL ON public.property_listings TO anon;

-- 7. Create function to search listings with filters
CREATE OR REPLACE FUNCTION search_property_listings(
  p_property_type TEXT DEFAULT NULL,
  p_min_bedrooms INTEGER DEFAULT NULL,
  p_max_bedrooms INTEGER DEFAULT NULL,
  p_min_price NUMERIC DEFAULT NULL,
  p_max_price NUMERIC DEFAULT NULL,
  p_community TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  property_id TEXT,
  property_title TEXT,
  property_url TEXT,
  property_type TEXT,
  community TEXT,
  project_name TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  built_up_area_sqft NUMERIC,
  price_aed NUMERIC,
  handover_status TEXT,
  furnishing_status TEXT,
  key_features JSONB,
  agent_name TEXT,
  agent_phone TEXT,
  image_urls JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pl.id,
    pl.property_id,
    pl.property_title,
    pl.property_url,
    pl.property_type,
    pl.community,
    pl.project_name,
    pl.bedrooms,
    pl.bathrooms,
    pl.built_up_area_sqft,
    pl.price_aed,
    pl.handover_status,
    pl.furnishing_status,
    pl.key_features,
    pl.agent_name,
    pl.agent_phone,
    pl.image_urls
  FROM public.property_listings pl
  WHERE
    (p_property_type IS NULL OR LOWER(pl.property_type) = LOWER(p_property_type))
    AND (p_min_bedrooms IS NULL OR pl.bedrooms >= p_min_bedrooms)
    AND (p_max_bedrooms IS NULL OR pl.bedrooms <= p_max_bedrooms)
    AND (p_min_price IS NULL OR pl.price_aed >= p_min_price)
    AND (p_max_price IS NULL OR pl.price_aed <= p_max_price)
    AND (p_community IS NULL OR LOWER(pl.community) LIKE '%' || LOWER(p_community) || '%')
  ORDER BY pl.synced_at DESC, pl.created_at DESC
  LIMIT p_limit;
END;
$$;

-- 8. Verify the table was created
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'property_listings' 
ORDER BY ordinal_position;
