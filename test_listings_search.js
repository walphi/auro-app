// Test the listings-helper module locally
// Run: node test_listings_search.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log('🔧 Testing Property Listings Search\n');
console.log('Supabase URL:', supabaseUrl);
console.log('Using key:', supabaseKey ? '✓ Found' : '✗ Missing');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSearch() {
    console.log('\n📋 Test 1: Search Dubai Marina properties');
    console.log('─'.repeat(50));

    try {
        const { data, error } = await supabase.rpc('search_property_listings', {
            p_community: 'Marina',
            p_offering_type: 'sale',
            p_limit: 3
        });

        if (error) {
            console.error('❌ Error:', error);
            return;
        }

        console.log(`✅ Found ${data?.length || 0} results\n`);

        if (data && data.length > 0) {
            data.forEach((listing, i) => {
                console.log(`${i + 1}. ${listing.title}`);
                console.log(`   📍 ${listing.community} - ${listing.sub_community}`);
                console.log(`   🏠 ${listing.bedrooms} BR | ${listing.bathrooms} BA | ${listing.area_sqft} sqft`);
                console.log(`   💰 AED ${listing.price.toLocaleString()}`);
                console.log('');
            });
        }
    } catch (e) {
        console.error('❌ Exception:', e.message);
    }

    console.log('\n📋 Test 2: Search 2-bedroom apartments');
    console.log('─'.repeat(50));

    try {
        const { data, error } = await supabase.rpc('search_property_listings', {
            p_min_bedrooms: 2,
            p_max_bedrooms: 2,
            p_offering_type: 'sale',
            p_limit: 5
        });

        if (error) {
            console.error('❌ Error:', error);
            return;
        }

        console.log(`✅ Found ${data?.length || 0} results\n`);

        if (data && data.length > 0) {
            data.forEach((listing, i) => {
                console.log(`${i + 1}. ${listing.title} - AED ${listing.price.toLocaleString()}`);
            });
        }
    } catch (e) {
        console.error('❌ Exception:', e.message);
    }

    console.log('\n📋 Test 3: Search properties under 3M AED');
    console.log('─'.repeat(50));

    try {
        const { data, error } = await supabase.rpc('search_property_listings', {
            p_max_price: 3000000,
            p_offering_type: 'sale',
            p_limit: 5
        });

        if (error) {
            console.error('❌ Error:', error);
            return;
        }

        console.log(`✅ Found ${data?.length || 0} results\n`);

        if (data && data.length > 0) {
            data.forEach((listing, i) => {
                console.log(`${i + 1}. ${listing.title} - AED ${listing.price.toLocaleString()}`);
            });
        }
    } catch (e) {
        console.error('❌ Exception:', e.message);
    }

    console.log('\n📋 Test 4: Direct table query (fallback test)');
    console.log('─'.repeat(50));

    try {
        const { data, error } = await supabase
            .from('property_listings')
            .select('id, title, community, bedrooms, price')
            .eq('status', 'active')
            .limit(3);

        if (error) {
            console.error('❌ Error:', error);
            return;
        }

        console.log(`✅ Found ${data?.length || 0} results via direct query\n`);

        if (data && data.length > 0) {
            data.forEach((listing, i) => {
                console.log(`${i + 1}. ${listing.title}`);
            });
        }
    } catch (e) {
        console.error('❌ Exception:', e.message);
    }

    console.log('\n✅ All tests completed!');
}

testSearch();
