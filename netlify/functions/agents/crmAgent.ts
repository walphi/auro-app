import { supabase } from "../../../lib/supabase";

export async function handleCRMAction(payload: any) {
    const { action, agentId, data } = payload;
    console.log(`[CRMAgent] Handling ${action} for ${agentId}`);

    if (action === "follow_up") {
        // Logic to send WhatsApp follow-ups or manage lead sequences
        return { text: "CRMAgent: Follow-up message scheduled/dispatched." };
    }

    return { text: "CRMAgent: Unsupported action." };
}
