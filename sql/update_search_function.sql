-- Update search_property_listings function to include image_url_jpeg
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
    image_url_jpeg TEXT, -- New column
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
        pl.image_url_jpeg, -- New column
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
