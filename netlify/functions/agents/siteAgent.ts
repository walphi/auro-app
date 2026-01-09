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

        console.info(`[SiteAgent] Invoking build-site-background for agentId: ${agentId} at URL: ${buildUrl}`);

        try {
            // We use a short timeout because it's a background function; it should return 202 quickly.
            const response = await axios.post(buildUrl, { agentId }, {
                timeout: 8000,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Auro-SiteAgent'
                }
            });

            console.info(`[SiteAgent] Build triggered successfully. Status: ${response.status}`);
            return { text: `Site build triggered for agent ${agentId}. Status: Queued` };
        } catch (e: any) {
            console.error(`[SiteAgent] Build trigger failed:`, e.message);
            // Even if the trigger fails, we log it for the broker but they might need to retry.
            return { text: `⚠️ Failed to trigger build: ${e.message}. Status: Error` };
        }
    }

    return { text: "SiteAgent: Unsupported action." };
}
