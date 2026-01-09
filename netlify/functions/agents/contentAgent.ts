import { supabase } from "../../../lib/supabase";
import { formatAgentResponse } from "../../../lib/agentUtils";

export async function handleContentAction(payload: any) {
    const { action, agentId } = payload;
    console.log(`[ContentAgent] Handling ${action} for ${agentId}`);

    if (action === "edit_content") {
        return formatAgentResponse("Got it ✅ Bio updated. Ready for Step 2?", 1);
    }

    return { text: "ContentAgent: Unsupported action." };
}
