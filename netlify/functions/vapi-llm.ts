import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { getListingById } from "./listings-helper";
import axios from "axios";

async function sendWhatsAppMessage(to: string, text: string): Promise<boolean> {
    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const from = process.env.TWILIO_PHONE_NUMBER || 'whatsapp:+14155238886';

        if (!accountSid || !authToken) return false;

        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const params = new URLSearchParams();
        params.append('To', to.startsWith('whatsapp:') ? to : `whatsapp:${to}`);
        params.append('From', from.startsWith('whatsapp:') ? from : `whatsapp:${from}`);
        params.append('Body', text);

        const response = await axios.post(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
            params,
            { headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        return response.status === 201 || response.status === 200;
    } catch (error: any) {
        console.error("[VAPI WhatsApp Error]:", error.message);
        return false;
    }
}

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
4. TIMEZONE: Asia/Dubai (UTC+4).
5. CURRENT DATE: ${new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Dubai', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
6. Resolve "tomorrow at 4pm" relative to the CURRENT DATE.
7. Confirm booking details clearly.
`;

        // 2. Call Gemini
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            systemInstruction: systemInstruction,
            tools: [
                {
                    functionDeclarations: [
                        {
                            name: "SEARCH_LISTINGS",
                            description: "Search for available property listings in Dubai.",
                            parameters: {
                                type: "OBJECT",
                                properties: {
                                    property_type: { type: "STRING" },
                                    community: { type: "STRING" },
                                    min_price: { type: "NUMBER" },
                                    max_price: { type: "NUMBER" },
                                    min_bedrooms: { type: "NUMBER" }
                                }
                            }
                        },
                        {
                            name: "UPDATE_LEAD",
                            description: "Update lead profile with qualification details.",
                            parameters: {
                                type: "OBJECT",
                                properties: {
                                    name: { type: "STRING" },
                                    email: { type: "STRING" },
                                    budget: { type: "STRING" },
                                    location: { type: "STRING" },
                                    property_type: { type: "STRING" },
                                    timeline: { type: "STRING" }
                                }
                            }
                        },
                        {
                            name: "BOOK_VIEWING",
                            description: "Book a property viewing appointment. Requires a resolved ISO 8601 datetime.",
                            parameters: {
                                type: "OBJECT",
                                properties: {
                                    property_id: { type: "STRING" },
                                    resolved_datetime: { type: "STRING", description: "ISO 8601 string with timezone offset, e.g., 2025-12-23T16:00:00+04:00" },
                                    property_name: { type: "STRING" }
                                },
                                required: ["resolved_datetime", "property_id"]
                            }
                        }
                    ]
                }
            ] as any
        });
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

                        // Fetch property details for confirmation
                        let listingTitle = property_name || "Property";
                        if (!property_name && property_id) {
                            const listing = await getListingById(property_id);
                            if (listing) listingTitle = listing.title;
                        }

                        // Format Date for Dubai
                        const dateObj = new Date(resolved_datetime);
                        const formattedDate = dateObj.toLocaleString('en-US', {
                            weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Dubai'
                        }) + " Dubai time";

                        // Send WhatsApp Confirmation
                        const calLink = `https://cal.com/provident-real-estate/viewing?date=${encodeURIComponent(resolved_datetime)}&property=${encodeURIComponent(property_id)}`;
                        const messageText = `✅ Booking Confirmed!\n\nProperty: ${listingTitle}\nDate: ${formattedDate}\n\nOur agent will meet you at the location. You can manage your booking here: ${calLink}`;

                        if (phoneNumber) {
                            await sendWhatsAppMessage(phoneNumber, messageText);
                        }

                        // Log message
                        await supabase.from('messages').insert({
                            lead_id: leadId,
                            type: 'System_Note',
                            sender: 'System',
                            content: `Booking Confirmed for ${listingTitle} at ${formattedDate}`
                        });
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
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            },
            body: `data: ${JSON.stringify(fallbackChunk)}\n\ndata: [DONE]\n\n`
        };
    }
};

export { handler };
