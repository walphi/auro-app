import { supabase } from "../../../lib/supabase";
import { formatAgentResponse } from "../../../lib/agentUtils";

export async function handleThemeAction(payload: any) {
    const { action, agentId, payload: innerPayload } = payload;
    const text = innerPayload?.text || "";
    console.log(`[ThemeAgent] Handling ${action} for ${agentId}`);

    if (action === "edit_theme") {
        return formatAgentResponse("Colours set successfully 🎨💛💙 Looking premium! Step 4/5 – Listings 🏙️", 3);
    }

    if (action === "update_theme_direct") {
        // Simple heuristic: if it contains a #, try to extract it as primary color
        const hexMatch = text.match(/#[0-9A-Fa-f]{6}/);
        const primaryColor = hexMatch ? hexMatch[0] : null;

        const { data: config } = await supabase
            .from('agentconfigs')
            .update({
                primary_color: primaryColor || text.substring(0, 50),
                needs_site_rebuild: true
            })
            .eq('agent_id', agentId)
            .select('slug')
            .single();

        return {
            text: `Colours set successfully 🎨💛💙 Looking premium!\nYour live site is updated here: https://auroapp.com/sites/${config?.slug || ''}`
        };
    }

    return { text: "ThemeAgent: Unsupported action." };
}
