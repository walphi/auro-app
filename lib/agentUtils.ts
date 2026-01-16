import { supabase } from "./supabase";
import crypto from 'crypto';

/**
 * Generate a deterministic UUID from a string (e.g., phone number).
 */
function getDeterministicUuid(str: string): string {
    const hash = crypto.createHash('sha256').update(str).digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

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
 * agentId: uuid
 * channel: "whatsapp" | "web" | etc.
 * userKey: phone number or other identifier (text)
 */
export async function getOrUpdateSession(agentId: string, userKey: string, channel: string = 'whatsapp', newState?: any) {
    if (!agentId || !userKey) {
        console.error("[AgentUtils] Missing agentId or userKey for session", { agentId, userKey, channel });
        return null;
    }

    console.info(`[AgentUtils] Session params { agentId: ${agentId}, channel: ${channel}, userKey: ${userKey} }`);

    // 1. Resolve leadId (UUID) from leads table using userKey (phone)
    // This ensures we satisfy the foreign key constraint on agent_sessions.lead_id
    let leadId: string | null = null;

    try {
        const { data: existingLead, error: leadError } = await supabase
            .from('leads')
            .select('id')
            .eq('phone', userKey)
            .maybeSingle();

        if (existingLead) {
            leadId = existingLead.id;
        } else {
            console.info(`[AgentUtils] Lead not found for ${userKey}, creating...`);
            const { data: newLead, error: createLeadError } = await supabase
                .from('leads')
                .insert({
                    phone: userKey,
                    name: 'Agent Sites User',
                    status: 'onboarding'
                })
                .select()
                .single();

            if (newLead) {
                leadId = newLead.id;
            } else {
                console.error("[AgentUtils] Failed to create lead:", createLeadError);
                // Fallback to deterministic UUID if lead creation fails (might fail if RLS prevents it)
                leadId = getDeterministicUuid(`${channel}:${userKey}`);
            }
        }
    } catch (e) {
        console.error("[AgentUtils] Lead resolution exception:", e);
        leadId = getDeterministicUuid(`${channel}:${userKey}`);
    }

    const { data: session, error: fetchError } = await supabase
        .from('agent_sessions')
        .select('*')
        .eq('agent_id', agentId)
        .eq('lead_id', leadId)
        .maybeSingle();

    if (fetchError) {
        console.error("[AgentUtils] Session fetch error:", fetchError.message || fetchError);
    }

    if (newState) {
        if (session) {
            const { data: updated, error: updateError } = await supabase
                .from('agent_sessions')
                .update({
                    state: {
                        ...(session.state || {}),
                        ...newState,
                        channel,
                        user_key: userKey
                    },
                    last_activity: new Date().toISOString()
                })
                .eq('id', session.id)
                .select()
                .single();

            if (updateError) console.error("[AgentUtils] Session update error:", updateError.message || updateError);
            return updated;
        } else {
            const { data: inserted, error: insertError } = await supabase
                .from('agent_sessions')
                .insert({
                    agent_id: agentId,
                    lead_id: leadId,
                    state: {
                        ...newState,
                        channel,
                        user_key: userKey
                    }
                })
                .select()
                .single();

            if (insertError) console.error("[AgentUtils] Session insert error:", insertError.message || insertError);
            return inserted;
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
