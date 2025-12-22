import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import { searchListings, formatListingsForVoice, SearchFilters } from "./listings-helper";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const VAPI_SECRET = process.env.VAPI_SECRET;

const handler: Handler = async (event) => {
    try {
        if (event.httpMethod !== "POST") {
            return { statusCode: 405, body: "Method Not Allowed" };
        }

        // Security Check
        const secret = event.headers["x-vapi-secret"];
        if (VAPI_SECRET && secret !== VAPI_SECRET) {
            console.error("[VAPI-LLM] Unauthorized: Invalid X-VAPI-SECRET");
            return { statusCode: 401, body: "Unauthorized" };
        }

        const body = JSON.parse(event.body || "{}");
        const { messages, call } = body;

        console.log(`[VAPI-LLM] Received request on path: ${event.path} (Method: ${event.httpMethod})`);
        console.log("[VAPI-LLM] Received request for call SID:", call?.id);

        // 1. Extract Lead Context
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

        // 2. Prepare System Prompt with Context
        const contextString = leadData ? `
CURRENT LEAD PROFILE:
- id: ${leadId}
- Name: ${leadData.name || "Unknown"}
- Phone: ${leadData.phone}
- Email: ${leadData.email || "Unknown"}
- Budget: ${leadData.budget || "Unknown"}
- Preferred Location/Communities: ${leadData.location || "Unknown"}
- Property Type: ${leadData.property_type || "Unknown"}
- Timeline/Move-in Date: ${leadData.timeline || "Unknown"}
- Currently interested in Property ID: ${leadData.current_listing_id || "None"}
- Last Image Index Shown on WhatsApp: ${leadData.last_image_index || 0}
- Booking Status: ${leadData.booking_status || "none"}
- Existing Booking: ${leadData.viewing_datetime || "None"}
` : "NEW LEAD - No existing context.";

        const systemInstruction = `You are Morgan, an AI-first Lead Qualification Agent for Provident Real Estate in Dubai.
Goal: Qualify the lead and book a viewing for their preferred property.

${contextString}

RULES:
1. Be professional, concise, and helpful. Focus on high-value Dubai real estate.
2. Use 'SEARCH_LISTINGS' to find properties if user requirements are clear or if they ask what's available.
3. Use 'UPDATE_LEAD' to save details (name, email, budget, etc.).
4. Use 'BOOK_VIEWING' once they are interested in a specific property.
5. TIMEZONE: All bookings are in Asia/Dubai (UTC+4).
6. DATE HANDLING: If the user says "tomorrow at 4", resolve it to an ISO 8601 string (e.g., 2025-12-23T16:00:00+04:00) before calling 'BOOK_VIEWING'.
7. AMBIGUITY: If the user is vague (e.g., "let's do next week" or "on Tuesday" without a time), YOU MUST clarify and get a specific day and time before calling 'BOOK_VIEWING'.
8. Always confirm the booking details clearly: Day, Date, Time, and "Dubai time".
9. DO NOT invent information. Use RAG (context) or tool results.
`;

        // 3. Call Gemini
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
            history: messages.map((m: any) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content || "" }]
            }))
        });

        // The last message is the prompt
        const lastMsg = messages[messages.length - 1]?.content || "Hello";
        const result = await chat.sendMessage(lastMsg);
        const response = await result.response;

        const text = response.text();
        const functionCalls = response.functionCalls();

        // 4. Handle Tool Calls & Format for Vapi
        // Vapi expects OpenAI format: choices[].message.tool_calls
        const tool_calls = functionCalls?.map((call, index) => ({
            id: `call_${Date.now()}_${index}`,
            type: "function",
            function: {
                name: call.name,
                arguments: JSON.stringify(call.args)
            }
        }));

        const openaiResponse = {
            id: `chatcmpl-${Date.now()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: "gemini-2.0-flash",
            choices: [
                {
                    index: 0,
                    message: {
                        role: "assistant",
                        content: text || null,
                        tool_calls: tool_calls || undefined
                    },
                    finish_reason: tool_calls ? "tool_calls" : "stop"
                }
            ]
        };

        console.log("[VAPI-LLM] Sent response:", text ? "Text response" : "Tool call");

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(openaiResponse)
        };

    } catch (error: any) {
        console.error("[VAPI-LLM] Error:", error.message);
        return {
            statusCode: 200, // Return 200 with error message to avoid Vapi hanging
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                choices: [{ message: { role: "assistant", content: "I'm sorry, I'm having trouble processing that right now." } }]
            })
        };
    }
};

export { handler };
