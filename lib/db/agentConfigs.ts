import { supabase } from '../supabase';

export async function getAgentConfigByAgentId(agentId: string) {
    const { data, error } = await supabase
        .from('agentconfigs')
        .select('*')
        .eq('agent_id', agentId)
        .single();

    return { data, error };
}

export async function getAgentConfigBySlug(slug: string) {
    const { data, error } = await supabase
        .from('agentconfigs')
        .select('*')
        .eq('slug', slug)
        .single();

    return { data, error };
}

export async function createOrUpdateAgentConfig(agentId: string, data: any) {
    // Check if exists
    const { data: existing } = await getAgentConfigByAgentId(agentId);

    if (existing) {
        return await supabase
            .from('agentconfigs')
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq('agent_id', agentId)
            .select()
            .single();
    } else {
        return await supabase
            .from('agentconfigs')
            .insert({
                agent_id: agentId,
                ...data,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();
    }
}

export async function getAgentSiteDocumentBySlug(slug: string) {
    // If agentconfigs was renamed, agent_site_documents might be too.
    // The user explicitly only mentioned agentconfigs. 
    // We'll try agent_site_documents first as it's in the original SQL.
    return await supabase
        .from('agent_site_documents')
        .select('*')
        .eq('slug', slug)
        .order('version', { ascending: false })
        .limit(1)
        .single();
}
