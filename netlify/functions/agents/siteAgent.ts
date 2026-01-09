import { supabase } from "../../../lib/supabase";
import { formatAgentResponse } from "../../../lib/agentUtils";
import axios from "axios";

export async function handleSiteAction(payload: any) {
    const { action, agentId } = payload;
    console.log(`[SiteAgent] Handling ${action} for ${agentId}`);

    if (action === "generate_site" || action === "publish_site") {
        let apiBase = (process.env.URL || process.env.VITE_API_BASE_URL || 'https://auroapp.com').trim();
        if (apiBase.endsWith('/')) apiBase = apiBase.slice(0, -1);

        const buildUrl = `${apiBase}/.netlify/functions/build-site-background`;

        console.info(`[SiteAgent] Invoking build-site-background for agentId: ${agentId}`);

        try {
            // Trigger background build asynchronously
            axios.post(buildUrl, { agentId }).catch(err => {
                console.error("[SiteAgent] Async build trigger failed:", err.message);
            });

            return formatAgentResponse(
                "Publishing your site now 🛠️ This usually takes 30–60 seconds. I'll message you once it's live ✨",
                5
            );
        } catch (e: any) {
            console.error(`[SiteAgent] Build trigger error:`, e.message);
            return { text: `⚠️ Build failed: ${e.message}. Type HELP if you need assistance.` };
        }
    }

    if (action === "view_site") {
        const { data: config } = await supabase
            .from('agentconfigs')
            .select('slug, status')
            .eq('agent_id', agentId)
            .single();

        if (config?.slug && config.status === 'live') {
            return { text: `Here’s your live site 🔗\nhttps://auroapp.com/${config.slug}` };
        } else {
            return { text: "Your site is not published yet 🚧 Reply *APPROVE* to publish." };
        }
    }

    return { text: "SiteAgent: Unsupported action." };
}
