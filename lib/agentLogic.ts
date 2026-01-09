
export type AgentMode = "NONE" | "EDIT_BIO" | "EDIT_THEME" | "EDIT_LISTINGS";

export interface AgentSessionState {
    step: number; // 0–5 for onboarding
    mode: AgentMode;
}

export interface AgentSession {
    agentId: string;
    leadId: string;
    state: AgentSessionState;
}

export type EdgeIntentAction =
    | "handle_message"
    | "update_areas"
    | "edit_content"
    | "edit_theme"
    | "publish_site"
    | "generate_site"
    | "view_site"
    | "follow_up"
    | "capture_listings"
    | string;

export interface EdgeIntentPayload {
    text?: string;
    from?: string;
    platform?: string;
}

export interface EdgeIntent {
    action: EdgeIntentAction;
    agentId: string;
    from: string;
    payload?: EdgeIntentPayload;
    source: string;
}

export type AgentDecisionType =
    | "START_ONBOARDING"
    | "CONTINUE_ONBOARDING_STEP"
    | "ENTER_EDIT_BIO"
    | "APPLY_EDIT_BIO"
    | "ENTER_EDIT_THEME"
    | "APPLY_EDIT_THEME"
    | "ENTER_EDIT_LISTINGS"
    | "APPLY_EDIT_LISTINGS"
    | "VIEW_SITE"
    | "SHOW_HELP"
    | "LEGACY_FALLBACK";

export interface AgentDecision {
    type: AgentDecisionType;
    nextState: AgentSessionState;
}

export function decideNextAction(input: {
    intent: EdgeIntent;
    session: AgentSession | null;
}): AgentDecision {
    const { intent, session } = input;
    const text = (intent.payload?.text || "").toLowerCase().trim();
    const currentStep = session?.state?.step || 0;
    const currentMode = session?.state?.mode || "NONE";

    // Priority 1: No session or explicit RESTART -> onboarding
    if (session === null || text === "restart") {
        return {
            type: "START_ONBOARDING",
            nextState: { step: 1, mode: "NONE" }
        };
    }

    // Priority 2: Handling explicit Commands (Help, View Site)
    if (text === "help") {
        return {
            type: "SHOW_HELP",
            nextState: { step: currentStep, mode: currentMode }
        };
    }

    if (text === "view site" || text === "view my site" || intent.action === "view_site") {
        return {
            type: "VIEW_SITE",
            nextState: { step: currentStep, mode: currentMode }
        };
    }

    // Priority 3: Existing session, currently in an EDIT mode
    if (currentMode === "EDIT_BIO") {
        return {
            type: "APPLY_EDIT_BIO",
            nextState: { step: currentStep, mode: "NONE" }
        };
    }
    if (currentMode === "EDIT_THEME") {
        return {
            type: "APPLY_EDIT_THEME",
            nextState: { step: currentStep, mode: "NONE" }
        };
    }
    if (currentMode === "EDIT_LISTINGS") {
        return {
            type: "APPLY_EDIT_LISTINGS",
            nextState: { step: currentStep, mode: "NONE" }
        };
    }

    // Priority 4: Onboarding Flow (Steps 1–4)
    if (currentStep >= 1 && currentStep < 5) {
        let nextStep = currentStep;
        // Map current step to expected progress
        // Step 1: Bio -> advance to 2
        // Step 2: Areas -> advance to 3
        // Step 3: Theme -> advance to 4
        // Step 4: Listings -> advance to 5
        // Note: The specific mapping is handled in the orchestrator routing, 
        // but the decision confirms we are continuing.

        // We can be smarter here: if intent matches a future step, maybe we jump?
        // For now, keep it linear as requested.

        // Logic hint: mis-detected intents (update_areas during step 1) 
        // are still treated as "CONTINUE_ONBOARDING_STEP" for the current step's agent.

        return {
            type: "CONTINUE_ONBOARDING_STEP",
            nextState: { step: nextStep, mode: "NONE" } // Next step update happens after success
        };
    }

    // Priority 5: Post-onboarding / READY state (Step 5)
    if (currentStep >= 5) {
        // Check for Edit requests
        if (intent.action === "edit_content" || text.includes("bio") || text.includes("about") || text.includes("profile")) {
            // If it looks like a bio edit request
            return {
                type: "ENTER_EDIT_BIO",
                nextState: { step: currentStep, mode: "EDIT_BIO" }
            };
        }

        if (intent.action === "edit_theme" || text.includes("color") || text.includes("colour") || text.includes("theme") || text.includes("brand")) {
            return {
                type: "ENTER_EDIT_THEME",
                nextState: { step: currentStep, mode: "EDIT_THEME" }
            };
        }

        if (intent.action === "capture_listings" || text.includes("listing") || text.includes("price") || text.includes("add listing")) {
            return {
                type: "ENTER_EDIT_LISTINGS",
                nextState: { step: currentStep, mode: "EDIT_LISTINGS" }
            };
        }

        // Default to Legacy / Fallback if at step 5 and no specific edit intent
        return {
            type: "LEGACY_FALLBACK",
            nextState: { step: currentStep, mode: "NONE" }
        };
    }

    // Catch-all
    return {
        type: "LEGACY_FALLBACK",
        nextState: { step: currentStep, mode: "NONE" }
    };
}
