import { Context } from "@netlify/edge-functions";

export default async (request: Request, context: Context) => {
    const USE_GEMMA_EDGE = Deno.env.get("USE_GEMMA_EDGE") === "true";
    const ORCHESTRATOR_URL = `${new URL(request.url).origin}/.netlify/functions/orchestrator`;

    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const contentType = request.headers.get("content-type") || "";
        let bodyText = "";

        if (contentType.includes("application/x-www-form-urlencoded")) {
            bodyText = await request.text();
        } else {
            // Just passthrough if not standard Twilio format, or handle JSON
            return await fetch(ORCHESTRATOR_URL, request);
        }

        const params = new URLSearchParams(bodyText);
        const messageText = params.get("Body") || "";
        const from = params.get("From") || "";

        console.log(`[Edge Intents] Incoming from ${from}: ${messageText}`);

        let intentPayload = null;

        if (USE_GEMMA_EDGE) {
            // Placeholder for actual Gemma local execution if supported by environment
            // In Netlify Edge, we typically call a lightweight WASM or an optimized endpoint
            // For this implementation, we simulate the logic or call the provided path
            try {
                intentPayload = await parseWithGemma(messageText);
            } catch (e) {
                console.error("[Edge Intents] Gemma failed, falling back", e);
            }
        }

        if (!intentPayload) {
            // Fallback to Orchestrator (which will handle Claude fallback if needed)
            return await fetch(ORCHESTRATOR_URL, {
                method: "POST",
                headers: request.headers,
                body: bodyText
            });
        }

        // Forward parsed intent to Orchestrator
        return await fetch(ORCHESTRATOR_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                ...intentPayload,
                rawBody: bodyText,
                from: from.replace("whatsapp:", "")
            })
        });

    } catch (error) {
        console.error("[Edge Intents] Error:", error);
        return await fetch(ORCHESTRATOR_URL, request);
    }
};

async function parseWithGemma(text: string) {
    // Logic to interface with FunctionGemma 270M
    // Since we are in an Edge Function environment, we assume a local or very fast endpoint
    // For now, we return null to trigger the orchestrator fallback unless specific Gemma setup is confirmed
    return null;
}

export const config = { path: "/edge/intents" };
