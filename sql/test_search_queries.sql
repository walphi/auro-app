-- Test Queries for search_property_listings Function
-- Run these in Supabase SQL Editor after inserting test data

-- Test 1: Search Dubai Marina properties (should return 4 results)
SELECT * FROM search_property_listings(
    p_community := 'Marina',
    p_offering_type := 'sale',
    p_limit := 10
);

-- Test 2: Search 2-bedroom apartments (should return 3 results)
SELECT * FROM search_property_listings(
    p_min_bedrooms := 2,
    p_max_bedrooms := 2,
    p_offering_type := 'sale',
    p_limit := 10
);

-- Test 3: Search properties under 3 million AED (should return 3 results)
SELECT * FROM search_property_listings(
    p_max_price := 3000000,
    p_offering_type := 'sale',
    p_limit := 10
);

-- Test 4: Search penthouses in Dubai Marina (should return 1 result)
SELECT * FROM search_property_listings(
    p_property_type := 'penthouse',
    p_community := 'Dubai Marina',
    p_offering_type := 'sale',
    p_limit := 10
);

-- Test 5: Search rental properties (should return 1 result)
SELECT * FROM search_property_listings(
    p_offering_type := 'rent',
    p_limit := 10
);

-- Test 6: Search Downtown properties (should return 1 result)
SELECT * FROM search_property_listings(
    p_community := 'Downtown',
    p_offering_type := 'sale',
    p_limit := 10
);

-- Test 7: Search 3-bedroom properties between 3-7 million (should return 2 results)
SELECT * FROM search_property_listings(
    p_min_bedrooms := 3,
    p_max_bedrooms := 3,
    p_min_price := 3000000,
    p_max_price := 7000000,
    p_offering_type := 'sale',
    p_limit := 10
);

-- Test 8: Get all active listings (should return 6 results)
SELECT * FROM search_property_listings(
    p_limit := 20
);
