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

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseImages() {
    console.log('🔍 Checking images in database for Creek Beach property...\n');

    const { data, error } = await supabase
        .from('property_listings')
        .select('title, images')
        .ilike('community', '%Creek Beach%')
        .limit(1)
        .single();

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    console.log('Property:', data.title);
    console.log('\nImages in database:');

    if (data.images && data.images.length > 0) {
        data.images.forEach((img, i) => {
            console.log(`\n[${i + 1}] ${img}`);

            if (img.includes('?format=jpeg')) {
                console.log('    ❌ HAS ?format=jpeg parameter (THIS IS THE PROBLEM!)');
            } else if (img.includes('?')) {
                console.log('    ⚠️  Has other query parameters');
            } else {
                console.log('    ✅ Clean URL (no parameters)');
            }
        });
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n💡 DIAGNOSIS:');
    console.log('If images have ?format=jpeg in the DATABASE, that means');
    console.log('our migration script ADDED them. We need to remove them!');
}

checkDatabaseImages().catch(console.error);
