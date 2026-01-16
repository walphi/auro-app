import { Context } from "@netlify/edge-functions";

export default async (request: Request, context: Context) => {
    // 1. Properly accept POST requests
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const contentType = request.headers.get("content-type") || "";
        let parsed: any = {};

        // 2. Parse payload based on Content-Type
        if (contentType.includes("application/x-www-form-urlencoded")) {
            const bodyText = await request.text();
            const params = new URLSearchParams(bodyText);
            parsed = Object.fromEntries(params.entries());
        } else if (contentType.includes("application/json")) {
            parsed = await request.json();
        } else {
            return new Response("Unsupported Media Type", { status: 415 });
        }

        // 3. Build normalized payload
        const bodyText =
            parsed.Body ||
            parsed.payload?.text ||
            parsed.text ||
            '';

        const normalized = {
            platform: 'twilio',
            from: (parsed.From || parsed.WaId || parsed.from || "").replace("whatsapp:", ""),
            text: bodyText,
            raw: parsed
        };

        console.log(`[Edge Intents] Normalized payload from ${normalized.from}: "${bodyText.substring(0, 50)}"`);

        // 4. Call Gemma parsing logic (simulated for Edge performance)
        let intent = await parseWithGemma(normalized.text);

        if (!intent) {
            // Standard standardized intent object for orchestrator consumption
            intent = {
                action: parsed.action || "handle_message",
                agentId: parsed.agentId || null,
                from: normalized.from,
                payload: normalized,
                source: "edge"
            } as any;
        } else {
            // Enrich Gemma-detected intent
            intent = {
                ...(intent as any),
                agentId: parsed.agentId || null,
                from: normalized.from,
                source: "edge"
            } as any;
        }

        // 5. Return 200 with JSON intent
        return new Response(JSON.stringify(intent), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (error: any) {
        console.error("[Edge Intents] Error:", error.message);
        // Ensure even errors return JSON for the caller to handle
        return new Response(JSON.stringify({
            error: error.message,
            source: "edge_error"
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};

/**
 * Simulated FunctionGemma Intent Parsing
 * Detects actions for Site, Listing, Theme, etc.
 */
async function parseWithGemma(text: string): Promise<{ action: string } | null> {
    const t = text.toLowerCase();

    // Intent Detection Mapping (Stricter matching to avoid misclassifying bios)
    if (t.includes("create site") || t.includes("generate site")) return { action: "generate_site" };
    if (t.includes("publish") || t.includes("approve")) return { action: "publish_site" };

    // Listing/Portal links are high confidence
    if (t.includes("http") || t.includes("bayut.com") || t.includes("propertyfinder.ae")) return { action: "capture_listings" };

    // Theme/Style - require more context
    if (t.includes("change theme") || t.includes("change colors") || t.includes("brand color")) return { action: "edit_theme" };

    // Content/Bio - require more context
    if (t.includes("edit bio") || (t.includes("update") && t.includes("bio"))) return { action: "edit_content" };

    // Areas - require specific intent phrases
    if (t.includes("update my area") || t.includes("change my focus") || t.includes("update location")) return { action: "update_areas" };

    if (t.includes("follow up") || t.includes("nurture")) return { action: "follow_up" };

    return null;
}

export const config = { path: "/edge/intents" };
