
import { supabase } from './lib/supabase.js';

async function resetAgent() {
    const agentId = "1efaba76-6493-4154-b4e1-5b7a420cf584";
    console.log(`Resetting agent ${agentId} to PREVIEW_SUMMARY...`);

    // 1. Update Conversation State
    const { error: convError } = await supabase
        .from('site_conversations')
        .update({
            current_state: 'PREVIEW_SUMMARY',
            updated_at: new Date().toISOString()
        })
        .eq('agent_id', agentId);

    if (convError) {
        console.error('Error resetting conversation:', convError.message);
    } else {
        console.log('Successfully reset conversation state.');
    }

    // 2. Also ensure the config status is 'draft' or similar to allow re-publication if needed
    // (Optional, but good for a clean test loop)
    const { error: configError } = await supabase
        .from('agentconfigs')
        .update({
            status: 'draft', // Reset to draft so 'approve' triggers the logic again
            updated_at: new Date().toISOString()
        })
        .eq('agent_id', agentId);

    if (configError) {
        console.error('Error resetting config status:', configError.message);
    } else {
        console.log('Successfully reset agent config status to draft.');
    }
}

resetAgent();
