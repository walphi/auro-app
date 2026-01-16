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
import { decideNextAction, AgentDecisionType, AgentSessionState } from "../../lib/agentLogic";

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
        const channel = payload?.platform || body.source || 'whatsapp';
        const session = await getOrUpdateSession(agentId, phone, channel);

        // 2. Decide Next Action (Business Logic Layer)
        // Normalize action for onboarding: during steps 1-4, treat free-text as handle_message 
        // to avoid misclassification (e.g. bios containing keywords triggered as CMS intents)
        let normalizedAction = action;
        const currentStep = session?.state?.step || 0;
        const text = (payload?.text || "").toLowerCase().trim();
        const isKeywordCommand = ["restart", "help", "view site", "publish", "approve"].some(k => text.includes(k));

        if (currentStep > 0 && currentStep < 5 && !isKeywordCommand) {
            console.log(`[Orchestrator] Normalizing ${action} -> handle_message for onboarding step ${currentStep}`);
            normalizedAction = "handle_message";
        }

        const decision = decideNextAction({
            intent: { ...body, action: normalizedAction, from: phone, source: body.source || 'edge' },
            session: session ? { agentId, leadId: phone, state: session.state } : null
        });

        console.info(`[AgentLogic] Agent ${agentId} step ${currentStep} mode ${session?.state?.mode} → decision ${decision.type} nextStep ${decision.nextState.step} nextMode ${decision.nextState.mode}`);

        // 3. Log the intent
        await supabase.from('agent_intents_log').insert({
            agent_id: agentId,
            message: payload?.text || "No text",
            parsed_action: body,
            source: body.source || 'orchestrator',
            latency_ms: 0
        });

        // 4. Execute Decision
        let response: any = null;

        switch (decision.type) {
            case "START_ONBOARDING":
                response = { text: "Welcome to Auro Agent Sites 👋\nWe’ll launch your luxury website in 5 quick steps.\n\nStep 1/5 – Your bio 🧑‍💼\n\nPlease tell me a bit about yourself and your experience." };
                break;

            case "CONTINUE_ONBOARDING_STEP":
                const step = session?.state?.step || 1;
                if (step === 1) {
                    response = await routeToAgent("contentAgent", { ...body, action: "edit_content" });
                    decision.nextState.step = 2;
                } else if (step === 2) {
                    response = await routeToAgent("listingAgent", { ...body, action: "update_areas" });
                    decision.nextState.step = 3;
                } else if (step === 3) {
                    response = await routeToAgent("themeAgent", { ...body, action: "edit_theme" });
                    decision.nextState.step = 4;
                } else if (step === 4) {
                    response = await routeToAgent("listingAgent", { ...body, action: "capture_listings" });
                    decision.nextState.step = 5;
                } else if (step === 5) {
                    // Check for approval/publish
                    if (action === "publish_site" || action === "generate_site") {
                        response = await routeToAgent("siteAgent", body);
                    } else {
                        response = { text: "What would you like to update? (bio, colors, listings, view site)" };
                    }
                }
                break;

            case "ENTER_EDIT_BIO":
                response = { text: "No problem ✏️ Please send your new bio text." };
                break;

            case "APPLY_EDIT_BIO":
                response = await routeToAgent("contentAgent", { ...body, action: "update_bio_direct" });
                break;

            case "ENTER_EDIT_THEME":
                response = { text: "Sure 🎨 Send your new brand colours or hex codes." };
                break;

            case "APPLY_EDIT_THEME":
                response = await routeToAgent("themeAgent", { ...body, action: "update_theme_direct" });
                break;

            case "ENTER_EDIT_LISTINGS":
                response = { text: "Ready 🏙️ Please send the link to your listing or the update details." };
                break;

            case "APPLY_EDIT_LISTINGS":
                response = await routeToAgent("listingAgent", { ...body, action: "capture_listings" });
                break;

            case "VIEW_SITE":
                response = await handleSiteAction({ action: "view_site", agentId });
                break;

            case "SHOW_HELP":
                response = { text: "Available commands:\n- ADD LISTING\n- UPDATE PRICE\n- UPDATE BIO\n- CHANGE COLORS\n- VIEW SITE\n- RESTART" };
                break;

            case "LEGACY_FALLBACK":
            default:
                response = await handleFallback(body);
                break;
        }

        // 5. Update Session State
        if (decision.nextState) {
            const channel = payload?.platform || body.source || 'whatsapp';
            await getOrUpdateSession(agentId, phone, channel, decision.nextState);
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
