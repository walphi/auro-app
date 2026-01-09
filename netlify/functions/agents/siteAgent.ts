import { supabase } from "../../../lib/supabase";
import axios from "axios";

export async function handleSiteAction(payload: any) {
    const { action, agentId } = payload;
    console.log(`[SiteAgent] Handling ${action} for ${agentId}`);

    if (action === "generate_site" || action === "publish_site") {
        // Trigger the legacy build-site-background logic
        let apiBase = (process.env.URL || process.env.VITE_API_BASE_URL || 'https://auroapp.com').trim();
        if (apiBase.endsWith('/')) apiBase = apiBase.slice(0, -1);

        const buildUrl = `${apiBase}/.netlify/functions/build-site-background`;

        try {
            const response = await axios.post(buildUrl, { agentId }, {
                timeout: 5000,
                headers: { 'Content-Type': 'application/json' }
            });
            return { text: `Site build triggered for agent ${agentId}. Status: ${response.data.message || 'Queued'}` };
        } catch (e: any) {
            console.error(`[SiteAgent] Build error:`, e.message);
            return { text: `Failed to trigger site build: ${e.message}` };
        }
    }

    return { text: "SiteAgent: Unsupported action." };
}
