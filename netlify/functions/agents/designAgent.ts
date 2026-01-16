import { supabase } from "../../../lib/supabase";
import { formatAgentResponse } from "../../../lib/agentUtils";
import { downloadAndStoreMedia } from "../../../lib/mediaHandler";

export async function handleDesignAction(payload: any) {
    const { action, agentId, from, payload: innerPayload } = payload;
    const text = innerPayload?.text || "";
    const mediaUrls = innerPayload?.mediaUrls || [];
    const phone = from || "";

    console.log(`[DesignAgent] Handling ${action} for ${agentId}. State: ${innerPayload?.state?.current_state}`);

    // This agent handles the COLLECT_STYLE_INSPIRATION states
    // However, if called from the orchestrator logic, we might need a simpler flow.

    if (action === "collect_inspiration") {
        // 1. Initial prompt
        return {
            text: "✨ *Let's capture your vision*\n\nThe best luxury sites have a distinct personality. To help me design yours, I'd love to see what inspires you.\n\n📸 *Please share a screenshot or a website URL* of a premium property website you admire.\n\n(or type 'skip')"
        };
    }

    if (action === "process_inspiration") {
        // We use stateData for sub-state tracking within the orchestrator step
        // session.state.subStep or similar if we had it, but for now we'll check presence of currentInspiration
        const { state: stateData } = innerPayload || {};
        const urlInfo = detectUrlType(text);
        const hasUrl = urlInfo.hasUrl;

        // Sub-state: Waiting for Description
        if (stateData?.currentInspiration) {
            const insp = stateData.currentInspiration;
            insp.user_description = text;

            const styleProfile = stateData.style_profile || { inspirations: [] };
            styleProfile.inspirations.push(insp);

            // Persist to DB
            await supabase
                .from('agentconfigs')
                .update({
                    style_profile: styleProfile,
                    needs_site_rebuild: true
                })
                .eq('agent_id', agentId);

            // Move to Confirm
            return {
                text: "Perfect, I've noted your style preferences! 🎨\n\nWould you like to add another inspiration? (Reply 'Add another' or 'Continue')",
                nextState: {
                    ...stateData,
                    style_profile: styleProfile,
                    currentInspiration: null,
                    awaiting_inspiration_confirm: true
                }
            };
        }

        // Sub-state: Confirm (Add another vs Continue)
        if (stateData?.awaiting_inspiration_confirm) {
            if (text.toLowerCase().includes('add another')) {
                return {
                    text: "Great! Send me another screenshot or URL of a site you love.",
                    nextState: { ...stateData, awaiting_inspiration_confirm: false }
                };
            } else {
                // Continue to Step 4 (Colors)
                // The orchestrator will handle the step increment if we return the right signal
                // For now, return a special text that tells the orchestrator to advance
                return {
                    text: "✅ *Style inspiration saved!*\n\nFinally, what colors represent your brand? Send hex codes or describe them (e.g. 'Dark navy and gold').",
                    advanceStep: true,
                    nextState: { ...stateData, awaiting_inspiration_confirm: false }
                };
            }
        }

        // Initial/Main state: Processing Image/URL
        if (text.toLowerCase() === 'skip') {
            return {
                text: "No problem! Finally, what colors represent your brand? Send hex codes or describe them (e.g. 'Dark navy and gold').",
                advanceStep: true
            };
        }

        if (mediaUrls.length > 0 || hasUrl) {
            const inspirationUrl = mediaUrls[0] || urlInfo.url;
            let storedUrl = inspirationUrl;

            if (mediaUrls.length > 0) {
                const uploaded = await downloadAndStoreMedia(mediaUrls[0], agentId);
                if (uploaded) storedUrl = uploaded;
            }

            const newInspiration = {
                id: `insp_${Date.now()}`,
                screenshot_path: storedUrl,
                timestamp: new Date().toISOString()
            };

            return {
                text: "Beautiful choice! 👀\n\nNow tell me — *what specifically do you love about this design?*\n\n(e.g. 'The dark palette', 'The minimal layout')",
                nextState: { ...stateData, currentInspiration: newInspiration }
            };
        }

        return { text: "📸 Please share a screenshot or a website URL (or type 'skip')." };
    }

    function detectUrlType(message: string): { hasUrl: boolean; url?: string } {
        const urlMatch = message.match(/https?:\/\/[^\s]+/);
        return { hasUrl: !!urlMatch, url: urlMatch?.[0] };
    }

    return { text: "DesignAgent: Unsupported action." };
}
