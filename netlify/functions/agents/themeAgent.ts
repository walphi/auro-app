import { supabase } from "../../../lib/supabase";
import { formatAgentResponse } from "../../../lib/agentUtils";

export async function handleThemeAction(payload: any) {
    const { action, agentId } = payload;
    console.log(`[ThemeAgent] Handling ${action} for ${agentId}`);

    if (action === "edit_theme") {
        return formatAgentResponse("Colours set successfully 🎨💛💙 Looking premium! Next: Step 4?", 3);
    }

    return { text: "ThemeAgent: Unsupported action." };
}
