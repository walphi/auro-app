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

import { getOrUpdateSession, formatAgentResponse } from "../../lib/agentUtils";

export const handler: Handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const body = JSON.parse(event.body || "{}");
        const { action, agentId, from, payload } = body;
        const phone = (from || payload?.from || "").replace("whatsapp:", "");

        console.log(`[Orchestrator] Action: ${action}, Agent: ${agentId}, From: ${phone}`);

        // 1. Manage Session State
        let session = await getOrUpdateSession(agentId, phone);
        const currentStep = session?.state?.step || 0;
        const text = (payload?.text || "").toLowerCase().trim();

        // Support RESTART
        if (text === "restart") {
            console.log(`[Sessions] Agent ${agentId} requested RESTART.`);
            await getOrUpdateSession(agentId, phone, { step: 1 });
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: "Welcome to Auro Agent Sites 👋\nWe’ve restarted your onboarding. Let’s build your luxury website!\n\nStep 1/5 – Your bio 🧑‍💼\n\nPlease tell me a bit about yourself." })
            };
        }

        // 2. Log the intent
        await supabase.from('agent_intents_log').insert({
            agent_id: agentId,
            message: payload?.text || "No text",
            parsed_action: body,
            source: body.source || 'orchestrator',
            latency_ms: 0
        });

        // 3. Route to specialized agents
        let response = null;
        let nextStep = currentStep;

        // Handle specific high-level commands first
        if (text === "help") {
            response = { text: "Available commands:\n- ADD LISTING\n- UPDATE PRICE\n- UPDATE BIO\n- CHANGE COLORS\n- VIEW SITE\n- RESTART" };
        } else if (text === "view site" || text === "view my site") {
            response = await handleSiteAction({ action: "view_site", agentId });
        } else if (currentStep === 0) {
            // Handle Welcome ONLY for truly new users (step 0) who didn't send a command
            nextStep = 1;
            console.log(`[Sessions] Agent ${agentId} step 0 → 1 (New User Welcome)`);
            await getOrUpdateSession(agentId, phone, { step: nextStep });
            response = { text: "Welcome to Auro Agent Sites 👋\nWe’ll launch your luxury website in 5 quick steps.\n\nStep 1/5 – Your bio 🧑‍💼\n\nPlease tell me a bit about yourself and your experience." };
        } else {
            console.log(`[Sessions] Agent ${agentId} processing action: ${action} at step: ${currentStep}`);

            switch (action) {
                case "handle_message":
                    if (text.includes("update") && text.includes("bio")) {
                        response = await routeToAgent("contentAgent", { ...body, action: "edit_content" });
                        nextStep = 2;
                    } else if (currentStep === 1) {
                        response = await routeToAgent("contentAgent", { ...body, action: "edit_content" });
                        nextStep = 2;
                    } else if (currentStep === 2) {
                        response = await routeToAgent("listingAgent", { ...body, action: "update_areas" });
                        nextStep = 3;
                    } else if (currentStep === 3) {
                        response = await routeToAgent("themeAgent", { ...body, action: "edit_theme" });
                        nextStep = 4;
                    } else if (currentStep === 4) {
                        response = await routeToAgent("listingAgent", { ...body, action: "capture_listings" });
                        nextStep = 5;
                    } else {
                        response = await handleFallback(body);
                    }
                    break;
                case "generate_site":
                case "publish_site":
                    if (currentStep < 4) {
                        response = { text: `We’re not ready to publish yet 🚧 You’re currently on Step ${currentStep}/5. Let’s finish the remaining steps first.` };
                    } else {
                        response = await routeToAgent("siteAgent", body);
                        nextStep = 5;
                    }
                    break;
                case "capture_listings":
                    response = await routeToAgent("listingAgent", body);
                    nextStep = 5;
                    break;
                case "update_areas":
                    // If detected as update_areas but we are at step 1, it's likely the bio
                    if (currentStep === 1) {
                        response = await routeToAgent("contentAgent", { ...body, action: "edit_content" });
                        nextStep = 2;
                    } else {
                        response = await routeToAgent("listingAgent", body);
                        nextStep = 3;
                    }
                    break;
                case "edit_theme":
                    response = await routeToAgent("themeAgent", body);
                    nextStep = 4;
                    break;
                case "edit_content":
                    response = await routeToAgent("contentAgent", body);
                    nextStep = 2;
                    break;
                case "follow_up":
                    response = await routeToAgent("crmAgent", body);
                    break;
                default:
                    response = await handleFallback(body);
            }

            if (nextStep !== currentStep) {
                console.log(`[Sessions] Agent ${agentId} step ${currentStep} → ${nextStep} on action ${action}`);
                await getOrUpdateSession(agentId, phone, { step: nextStep });
            }
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
    // Use Legacy logic as fallback to maintain state machine continuity
    console.log("[Orchestrator] Using legacy fallback for payload:", JSON.stringify(payload));

    try {
        const { processAgentSitesMessage } = require("../../lib/agentSitesConversation");
        const { from, payload: innerPayload } = payload;

        const msg = {
            from: from || innerPayload?.from,
            text: innerPayload?.text || "",
            mediaUrls: innerPayload?.mediaUrls || [],
            platform: "twilio" as const
        };

        const result = await processAgentSitesMessage(msg);
        return { text: result?.text || "I'm processing your request." };
    } catch (e: any) {
        console.error("[Orchestrator] Legacy fallback failed:", e.message);
        return { text: "I'm not sure how to handle that. Could you please rephrase?" };
    }
}
