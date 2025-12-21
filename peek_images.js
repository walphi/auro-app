import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function peekImages() {
    const { data } = await supabase.from('property_listings').select('images').limit(5);
    console.log('Sample Image URLs from DB:');
    data.forEach((row, i) => {
        console.log(`Listing ${i}:`, row.images ? row.images[0] : 'No images');
    });
}
peekImages();
