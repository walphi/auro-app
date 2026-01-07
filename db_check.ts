
import { supabase } from './lib/supabase.js';

async function check() {
    const agentId = "1efaba76-6493-4154-b4e1-5b7a420cf584";
    console.log(`Checking Agents table for ${agentId}...`);
    const { data: agent, error: agentError } = await supabase.from('agents').select('*').eq('id', agentId).single();
    if (agentError) console.error('Agent Error:', agentError.message);
    else console.log('Agent found:', agent.id, agent.phone);

    console.log(`Checking AgentConfigs table for ${agentId}...`);
    const { data: config, error: configError } = await supabase.from('agentconfigs').select('*').eq('agent_id', agentId).single();
    if (configError) console.error('Config Error:', configError.message);
    else console.log('Config found:', config.id, config.slug, config.status);
}

check();
