
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

dotenv.config({ path: path.resolve('.env.local') });

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function inspectTables() {
    const tables = ['leads', 'messages', 'agent_intents_log', 'lead_intents_log', 'agent_sessions'];
    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`Table ${table} Error: ${error.message}`);
        } else {
            console.log(`Table ${table} OK, rows: ${data.length}`);
            if (data.length > 0) {
                console.log(`Table ${table} columns: ${Object.keys(data[0]).join(', ')}`);
            }
        }
    }
}

inspectTables();
