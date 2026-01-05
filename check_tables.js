
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTables() {
    const tables = [
        'brokerages', 'agents', 'agent_configs', 'agentconfigs',
        'agent_site_documents', 'agentsitedocuments',
        'site_conversations', 'siteconversations'
    ];

    for (const table of tables) {
        try {
            const { error } = await supabase.from(table).select('count').limit(1);
            console.log(`${table}: ${error ? 'ERROR: ' + error.message : 'EXISTS'}`);
        } catch (e) {
            console.log(`${table}: NOT FOUND`);
        }
    }
}

checkTables();
