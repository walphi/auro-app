-- Property Listings Table for AURO Real Estate Platform
-- Run this in Supabase SQL Editor

-- 1. Create the property_listings table
CREATE TABLE IF NOT EXISTS public.property_listings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    external_id TEXT UNIQUE,                    -- ParseBot listing ID for deduplication
    
    -- Core Property Info
    title TEXT NOT NULL,
    description TEXT,
    property_type TEXT NOT NULL,                -- apartment, villa, townhouse, penthouse, etc.
    offering_type TEXT DEFAULT 'sale',          -- sale, rent
    
    -- Location
    community TEXT,                             -- Dubai Marina, Downtown, JBR, etc.
    sub_community TEXT,                         -- Building or sub-area name
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Specifications
    bedrooms INTEGER,
    bathrooms INTEGER,
    area_sqft DECIMAL(12, 2),
    floor_number INTEGER,
    
    -- Pricing
    price DECIMAL(15, 2),
    price_per_sqft DECIMAL(10, 2),
    currency TEXT DEFAULT 'AED',
    
    -- Media
    images JSONB DEFAULT '[]'::jsonb,           -- Array of image URLs
    virtual_tour_url TEXT,
    
    -- Agent/Source Info
    agent_name TEXT,
    agent_phone TEXT,
    agent_company TEXT,
    source TEXT DEFAULT 'parsebot',             -- Data source identifier
    source_url TEXT,                            -- Original listing URL
    
    -- Status and Metadata
    status TEXT DEFAULT 'active',               -- active, sold, rented, inactive
    featured BOOLEAN DEFAULT FALSE,
    
    -- Amenities and Features
    amenities JSONB DEFAULT '[]'::jsonb,        -- pool, gym, parking, etc.
    features JSONB DEFAULT '{}'::jsonb,         -- Additional features as key-value
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ DEFAULT NOW()         -- Last sync from external source
);

-- 2. Create indexes for search performance
CREATE INDEX IF NOT EXISTS idx_listings_community ON public.property_listings(community);
CREATE INDEX IF NOT EXISTS idx_listings_property_type ON public.property_listings(property_type);
CREATE INDEX IF NOT EXISTS idx_listings_price ON public.property_listings(price);
CREATE INDEX IF NOT EXISTS idx_listings_bedrooms ON public.property_listings(bedrooms);
CREATE INDEX IF NOT EXISTS idx_listings_status ON public.property_listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_offering ON public.property_listings(offering_type);
CREATE INDEX IF NOT EXISTS idx_listings_external ON public.property_listings(external_id);

-- Composite index for common search patterns
CREATE INDEX IF NOT EXISTS idx_listings_search ON public.property_listings(
    status, offering_type, property_type, community, price, bedrooms
);

-- 3. Enable RLS
ALTER TABLE public.property_listings ENABLE ROW LEVEL SECURITY;

-- 4. Create policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.property_listings;
DROP POLICY IF EXISTS "Enable write access for service role" ON public.property_listings;

CREATE POLICY "Enable read access for all users" 
    ON public.property_listings FOR SELECT USING (true);

CREATE POLICY "Enable write access for service role" 
    ON public.property_listings FOR ALL 
    USING (auth.role() = 'service_role');

-- 5. Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_property_listings_updated_at ON public.property_listings;
CREATE TRIGGER update_property_listings_updated_at
    BEFORE UPDATE ON public.property_listings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. Search Property Listings Function
-- Flexible search with multiple filter parameters
CREATE OR REPLACE FUNCTION search_property_listings(
    p_property_type TEXT DEFAULT NULL,
    p_min_bedrooms INTEGER DEFAULT NULL,
    p_max_bedrooms INTEGER DEFAULT NULL,
    p_min_price DECIMAL DEFAULT NULL,
    p_max_price DECIMAL DEFAULT NULL,
    p_community TEXT DEFAULT NULL,
    p_offering_type TEXT DEFAULT 'sale',
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    property_type TEXT,
    community TEXT,
    sub_community TEXT,
    bedrooms INTEGER,
    bathrooms INTEGER,
    area_sqft DECIMAL,
    price DECIMAL,
    price_per_sqft DECIMAL,
    images JSONB,
    agent_name TEXT,
    agent_phone TEXT,
    source_url TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pl.id,
        pl.title,
        pl.property_type,
        pl.community,
        pl.sub_community,
        pl.bedrooms,
        pl.bathrooms,
        pl.area_sqft,
        pl.price,
        pl.price_per_sqft,
        pl.images,
        pl.agent_name,
        pl.agent_phone,
        pl.source_url
    FROM public.property_listings pl
    WHERE pl.status = 'active'
        AND (p_offering_type IS NULL OR pl.offering_type = LOWER(p_offering_type))
        AND (p_property_type IS NULL OR LOWER(pl.property_type) = LOWER(p_property_type))
        AND (p_min_bedrooms IS NULL OR pl.bedrooms >= p_min_bedrooms)
        AND (p_max_bedrooms IS NULL OR pl.bedrooms <= p_max_bedrooms)
        AND (p_min_price IS NULL OR pl.price >= p_min_price)
        AND (p_max_price IS NULL OR pl.price <= p_max_price)
        AND (p_community IS NULL OR LOWER(pl.community) LIKE '%' || LOWER(p_community) || '%')
    ORDER BY pl.featured DESC, pl.updated_at DESC
    LIMIT p_limit;
END;
$$;

-- 7. Grant permissions
GRANT ALL ON public.property_listings TO authenticated;
GRANT ALL ON public.property_listings TO service_role;
GRANT ALL ON public.property_listings TO anon;
GRANT EXECUTE ON FUNCTION search_property_listings TO anon, authenticated, service_role;

-- 8. Add to realtime publication (optional - comment out if publication doesn't exist)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.property_listings;
