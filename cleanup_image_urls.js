import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

// Load Environment
const envPath = path.resolve('auro-rag-mcp', '.env');
const rootEnvPath = path.resolve('.env');
const localEnvPath = path.resolve('.env.local');

if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
if (fs.existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath });
if (fs.existsSync(localEnvPath)) dotenv.config({ path: localEnvPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Remove ?format=jpeg from all image URLs in the database
 */
async function cleanupImageURLs() {
    console.log('🧹 Cleaning up image URLs in database');
    console.log('═'.repeat(70));

    try {
        // Fetch all active listings
        const { data: listings, error } = await supabase
            .from('property_listings')
            .select('id, title, images')
            .eq('status', 'active');

        if (error) {
            console.error('❌ Error fetching listings:', error.message);
            return;
        }

        console.log(`\n📊 Found ${listings.length} active listings\n`);

        let updatedCount = 0;
        let skippedCount = 0;

        for (const listing of listings) {
            try {
                if (!listing.images || !Array.isArray(listing.images) || listing.images.length === 0) {
                    skippedCount++;
                    continue;
                }

                // Check if any images have ?format=jpeg
                const hasFormatParam = listing.images.some(img =>
                    typeof img === 'string' && img.includes('?format=jpeg')
                );

                if (!hasFormatParam) {
                    console.log(`✓ ${listing.title} - Already clean`);
                    skippedCount++;
                    continue;
                }

                // Remove ?format=jpeg from all images
                const cleanedImages = listing.images.map(img => {
                    if (typeof img === 'string' && img.includes('?format=jpeg')) {
                        return img.replace('?format=jpeg', '');
                    }
                    return img;
                });

                console.log(`🔄 Cleaning: ${listing.title}`);
                console.log(`   Before: ${listing.images[0].substring(0, 100)}...`);
                console.log(`   After:  ${cleanedImages[0].substring(0, 100)}...`);

                // Update the listing
                const { error: updateError } = await supabase
                    .from('property_listings')
                    .update({
                        images: cleanedImages,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', listing.id);

                if (updateError) {
                    console.error(`   ❌ Error updating: ${updateError.message}`);
                } else {
                    console.log(`   ✅ Cleaned successfully\n`);
                    updatedCount++;
                }

            } catch (e) {
                console.error(`❌ Error processing listing "${listing.title}":`, e.message);
            }
        }

        console.log('\n' + '═'.repeat(70));
        console.log(`✅ Cleanup Complete!`);
        console.log(`   Updated: ${updatedCount} listings`);
        console.log(`   Skipped: ${skippedCount} listings (already clean)`);
        console.log(`   Total: ${listings.length} listings`);
        console.log('═'.repeat(70));

    } catch (e) {
        console.error('❌ Exception during cleanup:', e.message);
    }
}

// Run the cleanup
cleanupImageURLs().catch(console.error);
