import { supabase } from "../../../lib/supabase";
import { formatAgentResponse } from "../../../lib/agentUtils";

export async function handleListingAction(payload: any) {
    const { action, agentId } = payload;
    console.log(`[ListingAgent] Handling ${action} for ${agentId}`);

    if (action === "update_areas") {
        return formatAgentResponse("Perfect ✅ I’ll highlight areas like DIFC & Downtown on your site. Step 3/5 – Brand colours & style 🎨", 2);
    }

    if (action === "capture_listings") {
        return formatAgentResponse("Perfect ✅ Listing saved 🏡 I've added it to your site data.", 4);
    }

    return { text: "ListingAgent: Unsupported action." };
}
