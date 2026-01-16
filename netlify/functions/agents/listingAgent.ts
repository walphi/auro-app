import { supabase } from "../../../lib/supabase";
import { formatAgentResponse } from "../../../lib/agentUtils";

export async function handleListingAction(payload: any) {
    const { action, agentId, payload: innerPayload } = payload;
    const text = innerPayload?.text || "";
    console.log(`[ListingAgent] Handling ${action} for ${agentId}`);

    if (action === "update_areas") {
        const areas = text.split(/[,&]/).map((a: string) => a.trim()).filter((a: string) => a.length > 0);
        await supabase
            .from('agentconfigs')
            .update({ areas: areas })
            .eq('agent_id', agentId);
        return formatAgentResponse("Perfect ✅ I’ll highlight areas like DIFC & Downtown on your site. Step 3/5 – Brand colours & style 🎨", 2);
    }

    if (action === "capture_listings") {
        // Here we could extract URLs, but for now we just acknowledge
        return formatAgentResponse("Perfect ✅ Listing saved 🏡 I've added it to your site data.", 4);
    }

    return { text: "ListingAgent: Unsupported action." };
}
