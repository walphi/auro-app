import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { handleSiteAction } from "./agents/siteAgent";
import { handleListingAction } from "./agents/listingAgent";
import { handleThemeAction } from "./agents/themeAgent";
import { handleContentAction } from "./agents/contentAgent";
import { handleCRMAction } from "./agents/crmAgent";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export const handler: Handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const body = JSON.parse(event.body || "{}");
        const { action, agentId, from, payload } = body;

        console.log(`[Orchestrator] Action: ${action}, Agent: ${agentId}, From: ${from}`);

        // Log the intent
        const { error: logError } = await supabase.from('agent_intents_log').insert({
            agent_id: agentId,
            message: payload?.text || "No text",
            parsed_action: body,
            source: body.source || 'orchestrator',
            latency_ms: 0 // Will be updated
        });

        if (logError) console.error("[Orchestrator] Log error:", logError);

        // Route to specialized agents
        let response = null;
        switch (action) {
            case "generate_site":
            case "publish_site":
                response = await routeToAgent("siteAgent", body);
                break;
            case "capture_listings":
                response = await routeToAgent("listingAgent", body);
                break;
            case "edit_theme":
                response = await routeToAgent("themeAgent", body);
                break;
            case "edit_content":
                response = await routeToAgent("contentAgent", body);
                break;
            case "follow_up":
                response = await routeToAgent("crmAgent", body);
                break;
            default:
                // Handle unparsed or unknown actions with a default/fallback
                response = await handleFallback(body);
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response)
        };

    } catch (error: any) {
        console.error("[Orchestrator] Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

async function routeToAgent(agentType: string, payload: any) {
    console.log(`[Orchestrator] Routing to ${agentType}`);
    switch (agentType) {
        case "siteAgent":
            return await handleSiteAction(payload);
        case "listingAgent":
            return await handleListingAction(payload);
        case "themeAgent":
            return await handleThemeAction(payload);
        case "contentAgent":
            return await handleContentAction(payload);
        case "crmAgent":
            return await handleCRMAction(payload);
        default:
            return { text: `Unknown agent type: ${agentType}` };
    }
}

async function handleFallback(payload: any) {
    // Use Claude or legacy logic as fallback
    console.log("[Orchestrator] Using fallback logic");
    return { text: "I'm not sure how to handle that. Could you please rephrase?" };
}
