
import { supabase } from './lib/supabase.js';

async function checkAgent() {
    const agentId = "1efaba76-6493-4154-b4e1-5b7a420cf584";
    console.log(`Checking for agent ${agentId} in agentconfigs...`);

    const { data, error } = await supabase
        .from('agentconfigs')
        .select('id, slug, status')
        .eq('agent_id', agentId)
        .single();

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Found agent config:', data);
    }
}

checkAgent();
