import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import fetch from 'node-fetch';

// Load Environment
const envPath = path.resolve('auro-rag-mcp', '.env');
const rootEnvPath = path.resolve('.env');
const localEnvPath = path.resolve('.env.local');

if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
if (fs.existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath });
if (fs.existsSync(localEnvPath)) dotenv.config({ path: localEnvPath });

// Configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testImageAccess() {
    console.log('🔍 Testing Image URL Accessibility\n');
    console.log('═'.repeat(70));

    // Get a few sample listings
    const { data: listings, error } = await supabase
        .from('property_listings')
        .select('id, title, images, source_url')
        .eq('status', 'active')
        .limit(5);

    if (error) {
        console.error('❌ Error fetching listings:', error.message);
        return;
    }

    console.log(`\n📊 Testing ${listings.length} listings...\n`);

    for (const listing of listings) {
        console.log(`\n📋 ${listing.title}`);
        console.log(`   Source: ${listing.source_url || 'N/A'}`);

        if (!listing.images || listing.images.length === 0) {
            console.log('   ⚠️  No images found');
            continue;
        }

        console.log(`   Images: ${listing.images.length}`);

        // Test first 3 images
        for (let i = 0; i < Math.min(3, listing.images.length); i++) {
            const imageUrl = listing.images[i];
            console.log(`\n   [${i + 1}] Testing: ${imageUrl.substring(0, 80)}...`);

            try {
                const response = await fetch(imageUrl, {
                    method: 'HEAD',
                    redirect: 'follow'
                });

                if (response.ok) {
                    console.log(`       ✅ ACCESSIBLE (${response.status})`);
                    console.log(`       Content-Type: ${response.headers.get('content-type')}`);
                    console.log(`       Content-Length: ${response.headers.get('content-length')} bytes`);
                } else {
                    console.log(`       ❌ NOT ACCESSIBLE (${response.status})`);
                    console.log(`       Error: ${response.statusText}`);

                    // Try without query parameters
                    const urlWithoutParams = imageUrl.split('?')[0];
                    if (urlWithoutParams !== imageUrl) {
                        console.log(`\n       🔄 Trying without parameters...`);
                        const retryResponse = await fetch(urlWithoutParams, {
                            method: 'HEAD',
                            redirect: 'follow'
                        });

                        if (retryResponse.ok) {
                            console.log(`       ✅ WORKS WITHOUT PARAMS (${retryResponse.status})`);
                            console.log(`       Use: ${urlWithoutParams}`);
                        } else {
                            console.log(`       ❌ Still fails (${retryResponse.status})`);
                        }
                    }
                }
            } catch (e) {
                console.log(`       ❌ FETCH ERROR: ${e.message}`);
            }
        }
    }

    console.log('\n' + '═'.repeat(70));
    console.log('\n💡 RECOMMENDATIONS:\n');
    console.log('If images are NOT ACCESSIBLE:');
    console.log('1. Check CloudFront distribution settings');
    console.log('2. Check S3 bucket public access settings');
    console.log('3. Verify CORS configuration');
    console.log('4. Contact Provident Estate for image access');
    console.log('5. Consider using a proxy service for images');
    console.log('\nIf images work WITHOUT PARAMS:');
    console.log('- Remove ?format=jpeg from URLs');
    console.log('- Use original image URLs directly');
}

testImageAccess().catch(console.error);
