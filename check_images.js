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

// Configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkImages() {
    console.log('🔍 Checking property listing images...\n');

    const { data: listings, error } = await supabase
        .from('property_listings')
        .select('id, title, images')
        .eq('status', 'active')
        .limit(5);

    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    console.log(`Found ${listings.length} listings:\n`);

    listings.forEach((listing, index) => {
        console.log(`${index + 1}. ${listing.title}`);
        console.log(`   Images: ${listing.images?.length || 0}`);
        if (listing.images && listing.images.length > 0) {
            listing.images.forEach((img, i) => {
                const format = img.match(/\.(webp|jpg|jpeg|png)(\?|$)/i)?.[1] || 'unknown';
                console.log(`     [${i + 1}] ${format.toUpperCase()}: ${img.substring(0, 80)}...`);
            });
        }
        console.log('');
    });
}

checkImages().catch(console.error);
