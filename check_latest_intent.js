
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

dotenv.config({ path: path.resolve('.env.local') });

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function checkLatestIntent() {
    console.log('--- Checking Latest Intent ---');
    const { data: intent, error } = await supabase
        .from('lead_intents_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Latest Intent Log Entry:');
        console.log(JSON.stringify(intent, null, 2));
    }
}

checkLatestIntent();
