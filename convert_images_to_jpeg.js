import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { convertImagesToJpeg } from './image-format-helper.js';

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

/**
 * Convert WebP images to JPEG in existing property listings
 */
async function convertExistingImages() {
    console.log('🔄 Converting WebP images to JPEG format for WhatsApp compatibility');
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

        console.log(`📊 Found ${listings.length} active listings to process\n`);

        let updatedCount = 0;
        let skippedCount = 0;

        for (const listing of listings) {
            try {
                if (!listing.images || !Array.isArray(listing.images) || listing.images.length === 0) {
                    console.log(`⏭️  Skipped: ${listing.title} (no images)`);
                    skippedCount++;
                    continue;
                }

                // Check if any images are WebP
                const hasWebP = listing.images.some(img =>
                    typeof img === 'string' && img.match(/\.webp(\?|$)/i)
                );

                if (!hasWebP) {
                    console.log(`✓ Skipped: ${listing.title} (already compatible)`);
                    skippedCount++;
                    continue;
                }

                // Convert images
                const originalImages = listing.images;
                const convertedImages = convertImagesToJpeg(originalImages);

                console.log(`🔄 Converting: ${listing.title}`);
                console.log(`   Original: ${originalImages.length} images`);
                console.log(`   Converted: ${convertedImages.length} images`);

                // Show first image conversion as example
                if (originalImages.length > 0 && convertedImages.length > 0) {
                    console.log(`   Example:`);
                    console.log(`     Before: ${originalImages[0].substring(0, 80)}...`);
                    console.log(`     After:  ${convertedImages[0].substring(0, 80)}...`);
                }

                // Update the listing
                const { error: updateError } = await supabase
                    .from('property_listings')
                    .update({
                        images: convertedImages,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', listing.id);

                if (updateError) {
                    console.error(`   ❌ Error updating: ${updateError.message}`);
                } else {
                    console.log(`   ✅ Updated successfully\n`);
                    updatedCount++;
                }

            } catch (e) {
                console.error(`❌ Error processing listing "${listing.title}":`, e.message);
            }
        }

        console.log('\n' + '═'.repeat(70));
        console.log(`✅ Conversion Complete!`);
        console.log(`   Updated: ${updatedCount} listings`);
        console.log(`   Skipped: ${skippedCount} listings`);
        console.log(`   Total: ${listings.length} listings`);
        console.log('═'.repeat(70));

    } catch (e) {
        console.error('❌ Exception during conversion:', e.message);
    }
}

// Run the conversion
convertExistingImages().catch(console.error);
