import { supabase } from "../../../lib/supabase";
import { formatAgentResponse } from "../../../lib/agentUtils";

export async function handleContentAction(payload: any) {
    const { action, agentId, payload: innerPayload } = payload;
    const text = innerPayload?.text || "";
    console.log(`[ContentAgent] Handling ${action} for ${agentId}`);

    if (action === "edit_content") {
        return formatAgentResponse("Got it ✅ Bio updated. Step 2/5 – Areas you focus on 📍", 1);
    }

    if (action === "update_bio_direct") {
        const { data: config } = await supabase
            .from('agentconfigs')
            .update({ bio: text })
            .eq('agent_id', agentId)
            .select('slug')
            .single();

        return {
            text: `Got it ✅ Bio updated.\nYour live site is updated here: https://auroapp.com/sites/${config?.slug || ''}`
        };
    }

    return { text: "ContentAgent: Unsupported action." };
}
