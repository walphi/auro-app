import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { getListingById } from "./listings-helper";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
);
const VAPI_SECRET = process.env.VAPI_SECRET;

const handler: Handler = async (event) => {
    try {
        if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

        const secret = event.headers["x-vapi-secret"];
        if (VAPI_SECRET && secret !== VAPI_SECRET) {
            console.error("[VAPI-LLM] Unauthorized");
            return { statusCode: 401, body: "Unauthorized" };
        }

        const body = JSON.parse(event.body || "{}");
        const { messages, call } = body;
        console.log(`[VAPI-LLM] Request for SID: ${call?.id}`);

        // 1. Context Loading
        let phoneNumber = call?.customer?.number;
        let leadId = call?.extra?.lead_id || call?.metadata?.lead_id;
        let leadData: any = null;

        if (phoneNumber) {
            phoneNumber = phoneNumber.replace('whatsapp:', '').trim();
            if (!phoneNumber.startsWith('+')) phoneNumber = '+' + phoneNumber;
        }

        if (leadId) {
            const { data } = await supabase.from('leads').select('*').eq('id', leadId).single();
            leadData = data;
        } else if (phoneNumber) {
            const { data } = await supabase.from('leads').select('*').eq('phone', phoneNumber).single();
            leadData = data;
        }
        leadId = leadData?.id;

        const contextString = leadData ? `
CURRENT LEAD PROFILE:
- Name: ${leadData.name || "Unknown"}
- Budget: ${leadData.budget || "Unknown"}
- Location: ${leadData.location || "Unknown"}
- Property Type: ${leadData.property_type || "Unknown"}
- Timeline: ${leadData.timeline || "Unknown"}
- Interest: ${leadData.current_listing_id || "None"}
- Booking: ${leadData.viewing_datetime || "None"}
` : "NEW LEAD - No context.";

        const systemInstruction = `You are Morgan, a Lead Qualification Agent for Provident Real Estate Dubai.
Goal: Qualify lead and book a viewing.
${contextString}
RULES:
1. Be professional, concise.
2. Use 'SEARCH_LISTINGS' if asked for properties.
3. Use 'BOOK_VIEWING' for specific interest.
4. TIMEZONE: Asia/Dubai (UTC+4). Resolve "tomorrow at 4" to ISO8601 (e.g. 2025-12-23T16:00:00+04:00).
5. Confirm booking details clearly.
`;

        // 2. Call Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", systemInstruction });
        const chat = model.startChat({
            history: messages.slice(0, -1).map((m: any) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content || "" }]
            }))
        });

        const lastMsg = messages[messages.length - 1]?.content || "Hello";
        const result = await chat.sendMessage(lastMsg);
        const response = await result.response;

        // 3. Process Response
        const text = response.text();
        const functionCalls = response.functionCalls();

        // Handle Tool Calls Logic for Vapi (simplified: we just perform side effects, Vapi expects text back usually)
        if (functionCalls && functionCalls.length > 0) {
            for (const call of functionCalls) {
                if (call.name === 'BOOK_VIEWING') {
                    const { property_id, resolved_datetime, property_name } = call.args as any;
                    if (property_id && resolved_datetime && leadId) {
                        await supabase.from('leads').update({
                            viewing_datetime: resolved_datetime,
                            booking_status: 'confirmed',
                            current_listing_id: property_id
                        }).eq('id', leadId);
                        // We could restart loop here if we wanted deeper agent logic, 
                        // but for V2 MVP we trust the model's text confirmation.
                    }
                }
            }
        }

        // 4. Stream Response
        const createdTimestamp = Math.floor(Date.now() / 1000);
        const chunk = {
            id: "chatcmpl-" + (body.call?.id ?? Date.now()),
            object: "chat.completion.chunk",
            created: createdTimestamp,
            model: "gpt-4.1-mini",
            choices: [{
                index: 0,
                delta: { role: "assistant", content: text || "I'm listening." },
                finish_reason: null
            }]
        };

        const sseBody = `data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`;

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            },
            body: sseBody
        };

    } catch (error: any) {
        console.error("[VAPI-LLM] Error:", error.message);
        const fallbackChunk = {
            id: "err-" + Date.now(),
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            choices: [{ delta: { content: "Sorry, I can't process that right now." }, finish_reason: null }]
        };
        return {
            statusCode: 200,
            headers: { "Content-Type": "text/event-stream" },
            body: `data: ${JSON.stringify(fallbackChunk)}\n\ndata: [DONE]\n\n`
        };
    }
};

export { handler };
