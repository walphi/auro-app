import { supabase } from "./supabase";

/**
 * Log an agent action and its latency to Supabase.
 */
export async function logAgentIntent(data: {
    agentId?: string;
    message: string;
    parsedAction: any;
    source: string;
    latencyMs: number;
}) {
    const { error } = await supabase.from('agent_intents_log').insert({
        agent_id: data.agentId,
        message: data.message,
        parsed_action: data.parsedAction,
        source: data.source,
        latency_ms: data.latencyMs
    });

    if (error) console.error("[AgentUtils] Log error:", error);
}

/**
 * Simple health check for FunctionGemma (simulated).
 */
export async function checkGemmaHealth(): Promise<boolean> {
    const USE_GEMMA_EDGE = process.env.USE_GEMMA_EDGE === "true";
    if (!USE_GEMMA_EDGE) return false;

    // In a real scenario, this might ping the edge function or local WASM loader
    try {
        // Placeholder for health check logic
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Handle agent sessions and state persistence.
 */
export async function getOrUpdateSession(agentId: string, leadId: string, newState?: any) {
    const { data: session, error } = await supabase
        .from('agent_sessions')
        .select('*')
        .eq('agent_id', agentId)
        .eq('lead_id', leadId)
        .single();

    if (newState) {
        if (session) {
            await supabase.from('agent_sessions').update({
                state: { ...(session.state || {}), ...newState },
                last_activity: new Date().toISOString()
            }).eq('id', session.id);
        } else {
            await supabase.from('agent_sessions').insert({
                agent_id: agentId,
                lead_id: leadId,
                state: newState
            });
        }
    }

    return session;
}

/**
 * Format a standard agent response with progress steps and emojis.
 */
export function formatAgentResponse(text: string, step?: number, totalSteps: number = 5) {
    let prefix = "";
    if (step === 1) prefix = "Step 1/5 – Your bio 🧑‍💼\n\n";
    if (step === 2) prefix = "Step 2/5 – Areas you focus on 📍\n\n";
    if (step === 3) prefix = "Step 3/5 – Brand colours & style 🎨\n\n";
    if (step === 4) prefix = "Step 4/5 – Listings 🏙️\n\n";
    if (step === 5) prefix = "Step 5/5 – Contact & WhatsApp CTA 📞\n\n";

    return { text: `${prefix}${text}` };
}
