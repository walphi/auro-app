
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

dotenv.config({ path: path.resolve('.env.local') });

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function checkAgentIntents() {
    const { data: cols, error } = await supabase.from('agent_intents_log').select('*').limit(1);
    if (error) {
        console.log('Error:', error.message);
    } else {
        console.log('agent_intents_log columns:', Object.keys(cols[0] || {}));
    }
}
checkAgentIntents();
