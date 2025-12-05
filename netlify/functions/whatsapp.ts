import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as querystring from "querystring";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// RAG Query Helper - prioritizes rag_chunks (hot topics), supplements with knowledge_base
async function queryRAG(query: string): Promise<string> {
    try {
        console.log('[RAG] Querying:', query);
        const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const embResult = await embedModel.embedContent(query);
        const embedding = embResult.embedding.values;

        let results: string[] = [];

        // Primary: Get from rag_chunks (hot topics, recent content)
        const { data: ragData, error: ragError } = await supabase.rpc('match_rag_chunks', {
            query_embedding: embedding,
            match_threshold: 0.5,  // Higher threshold for better relevance
            match_count: 3,
            filter_client_id: 'demo',
            filter_folder_id: null
        });

        if (!ragError && ragData && ragData.length > 0) {
            console.log('[RAG] rag_chunks:', ragData.length, 'results');
            results = ragData.map((i: any) => i.content);
        }

        // Supplement: Get from knowledge_base if needed
        if (results.length < 2) {
            const { data: kbData, error: kbError } = await supabase.rpc('match_knowledge', {
                query_embedding: embedding,
                match_threshold: 0.5,
                match_count: 3,
                filter_project_id: null
            });

            if (!kbError && kbData && kbData.length > 0) {
                console.log('[RAG] knowledge_base:', kbData.length, 'results');
                // Add only if not already included (avoid duplicates)
                kbData.forEach((i: any) => {
                    if (!results.includes(i.content)) {
                        results.push(i.content);
                    }
                });
            }
        }

        if (results.length > 0) {
            console.log('[RAG] Total results:', results.length);
            return results.slice(0, 3).join("\n\n");  // Max 3 results
        } else {
            return "No relevant information found in knowledge base.";
        }
    } catch (e: any) {
        console.error('[RAG] Exception:', e.message);
        return "Error searching knowledge base.";
    }
}

// Web Search Helper (Perplexity API)
async function searchWeb(query: string): Promise<string> {
    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
    if (!PERPLEXITY_API_KEY) return "Web search is disabled (API key missing).";

    try {
        console.log('[Web] Searching:', query);
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'sonar',
                messages: [
                    { role: 'system', content: 'You are a search assistant. Provide concise, factual answers with sources.' },
                    { role: 'user', content: query }
                ],
                max_tokens: 500,
                temperature: 0.2
            })
        });

        if (!response.ok) {
            console.error('[Web] API error:', response.status);
            return "Error searching the web.";
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "No results found.";
        console.log('[Web] Result length:', content.length);
        return content;
    } catch (e: any) {
        console.error('[Web] Exception:', e.message);
        return "Error searching the web.";
    }
}

async function initiateVapiCall(phoneNumber: string): Promise<boolean> {
    try {
        const payload = {
            phoneNumberId: process.env.VAPI_PHONE_NUMBER,
            assistantId: process.env.VAPI_ASSISTANT_ID,
            customer: {
                number: phoneNumber,
            },
        };

        console.log("[VAPI CALL] Initiating call with payload:", JSON.stringify(payload, null, 2));
        console.log("[VAPI CALL] API Key present:", !!process.env.VAPI_API_KEY);

        const response = await axios.post(
            'https://api.vapi.ai/call',
            payload,
            {
                headers: {
                    Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
                },
            }
        );

        console.log("[VAPI CALL] Response status:", response.status);
        console.log("[VAPI CALL] Response data:", JSON.stringify(response.data, null, 2));

        return response.status === 201;
    } catch (error: any) {
        console.error("[VAPI CALL] Error initiating VAPI call:", error.message);
        if (error.response) {
            console.error("[VAPI CALL] Error response status:", error.response.status);
            console.error("[VAPI CALL] Error response data:", JSON.stringify(error.response.data, null, 2));
        }
        return false;
    }
}

const handler: Handler = async (event) => {
    try {
        if (event.httpMethod !== "POST") {
            return { statusCode: 405, body: "Method Not Allowed" };
        }

        const body = querystring.parse(event.body || "");
        const userMessage = (body.Body as string) || "";
        const numMedia = parseInt((body.NumMedia as string) || "0");
        const fromNumber = (body.From as string).replace('whatsapp:', '');
        const host = event.headers.host || "auro-app.netlify.app";

        let isVoiceResponse = false;
        let responseText = "";

        console.log(`Received message from ${fromNumber}. Media: ${numMedia}, Text: "${userMessage.substring(0, 50)}..."`);

        // --- MEDIA RESOLUTION ---
        let resolvedMediaUrl: string | null = null;
        let mediaBuffer: Buffer | null = null;
        let mediaType: string | null = null;

        if (numMedia > 0) {
            const rawMediaUrl = body.MediaUrl0 as string;
            mediaType = body.MediaContentType0 as string;

            console.log(`Resolving media: ${rawMediaUrl} (${mediaType})`);

            try {
                const accountSid = process.env.TWILIO_ACCOUNT_SID;
                const authToken = process.env.TWILIO_AUTH_TOKEN;

                if (!accountSid || !authToken) {
                    throw new Error("Missing Twilio Credentials");
                }

                const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

                // Step 1: Request Media URL with Auth, but DO NOT follow redirects automatically
                const initialResponse = await axios.get(rawMediaUrl, {
                    headers: { Authorization: `Basic ${auth}` },
                    maxRedirects: 0,
                    validateStatus: (status) => status >= 200 && status < 400,
                    responseType: 'arraybuffer'
                });

                if (initialResponse.status === 302 || initialResponse.status === 301 || initialResponse.status === 307) {
                    const redirectUrl = initialResponse.headers.location;
                    console.log("Following media redirect to:", redirectUrl.substring(0, 50) + "...");

                    // Step 2: Fetch from S3 (or other location) WITHOUT Auth headers
                    const mediaResponse = await axios.get(redirectUrl, { responseType: 'arraybuffer' });
                    mediaBuffer = mediaResponse.data;
                    resolvedMediaUrl = redirectUrl; // Use the accessible URL
                } else {
                    mediaBuffer = initialResponse.data;
                    resolvedMediaUrl = rawMediaUrl; // Fallback to original if no redirect (unlikely for Twilio)
                }
            } catch (mediaError: any) {
                console.error("Error resolving media:", mediaError.message);
                // Fallback: Try fetching raw URL without auth
                try {
                    const publicResponse = await axios.get(rawMediaUrl, { responseType: 'arraybuffer' });
                    mediaBuffer = publicResponse.data;
                    resolvedMediaUrl = rawMediaUrl;
                } catch (e) {
                    console.error("Fallback media fetch failed.");
                }
            }
        }

        // --- SUPABASE: Get or Create Lead ---
        let leadId: string | null = null;
        let leadContext = "";

        if (supabaseUrl && supabaseKey) {
            const { data: existingLead, error: findError } = await supabase
                .from('leads')
                .select('*')
                .eq('phone', fromNumber)
                .single();

            if (existingLead) {
                leadId = existingLead.id;
                // Build Context - Ensure we check for all fields
                // Note: email and location might not exist in old schema, so we handle that gracefully
                const email = existingLead.email || "Unknown";
                const location = existingLead.location || "Unknown";
                const timeline = existingLead.timeline || "Unknown";

                leadContext = `
CURRENT LEAD PROFILE (DO NOT ASK FOR THESE IF KNOWN):
- Name: ${existingLead.name || "Unknown"}
- Email: ${email}
- Budget: ${existingLead.budget || "Unknown"}
- Location: ${location}
- Property Type: ${existingLead.property_type || "Unknown"}
- Timeline: ${timeline}
`;
            } else {
                console.log("Creating new lead for", fromNumber);
                const { data: newLead, error: createError } = await supabase
                    .from('leads')
                    .insert({
                        phone: fromNumber,
                        name: `WhatsApp Lead ${fromNumber}`,
                        status: 'New',
                        custom_field_1: 'Source: WhatsApp'
                    })
                    .select('id')
                    .single();

                if (newLead) leadId = newLead.id;
                if (createError) console.error("Error creating lead:", createError);
            }
        } else {
            console.error("Supabase credentials missing.");
        }

        // --- SUPABASE: Log User Message ---
        if (leadId) {
            try {
                if (numMedia > 0 && resolvedMediaUrl) {
                    if (mediaType?.startsWith('audio/')) {
                        // Log Voice Note
                        const { error: msgError } = await supabase.from('messages').insert({
                            lead_id: leadId,
                            type: 'Voice',
                            sender: 'Lead',
                            content: 'Voice Note',
                            meta: resolvedMediaUrl
                        });
                        if (msgError) console.error("Error logging Voice message:", msgError);
                    } else if (mediaType?.startsWith('image/')) {
                        // Log Image
                        const { error: msgError } = await supabase.from('messages').insert({
                            lead_id: leadId,
                            type: 'Image',
                            sender: 'Lead',
                            content: userMessage || 'Image Shared',
                            meta: resolvedMediaUrl
                        });
                        if (msgError) console.error("Error logging Image message:", msgError);
                    }
                } else if (userMessage) {
                    // Log Text Message
                    const { error: msgError } = await supabase.from('messages').insert({
                        lead_id: leadId,
                        type: 'Message',
                        sender: 'Lead',
                        content: userMessage
                    });
                    if (msgError) console.error("Error logging Text message:", msgError);
                }
            } catch (logError) {
                console.error("Exception logging message to Supabase:", logError);
            }
        }

        // --- GEMINI AGENT WITH TOOLS ---
        const systemInstruction = `You are Morgan, an AI-first Lead Qualification Agent for a premier Dubai real estate agency using the AURO platform. Your primary and most reliable source of information is your RAG Knowledge Base.

YOUR GOAL:
Qualify the lead by naturally asking for missing details.
${leadContext}

REQUIRED DETAILS (Ask only if "Unknown" above):
1. Name
2. Email Address
3. Budget
4. Property Type
5. Preferred Location
6. Timeline

RULES:
- IF the user provides any of the above details, YOU MUST CALL the 'UPDATE_LEAD' tool immediately.
- IF the user asks to be called (e.g., "call me", "can you call me", "ring me") in text or voice, YOU MUST CALL the 'INITIATE_CALL' tool.
- USE 'SEARCH_WEB_TOOL' if the user asks for current market data, competitor info, or general questions not in your knowledge base.
- DO NOT ask for information that is already listed as known in the CURRENT LEAD PROFILE.
- ALWAYS ground your answers in the RAG data or Web Search results.
- NEVER invent information.
- Maintain a professional, high-value tone.
- Keep responses under 50 words.`;

        const tools = [
            {
                functionDeclarations: [
                    {
                        name: "RAG_QUERY_TOOL",
                        description: "Search the knowledge base for specific factual information about projects, pricing, payment plans, etc.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                query: { type: "STRING", description: "The search query" }
                            },
                            required: ["query"]
                        }
                    },
                    {
                        name: "SEARCH_WEB_TOOL",
                        description: "Search the live web for real-time information, market trends, news, or competitor data.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                query: { type: "STRING", description: "The search query" }
                            },
                            required: ["query"]
                        }
                    },
                    {
                        name: "UPDATE_LEAD",
                        description: "Update the lead's profile with new information provided in the conversation.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                name: { type: "STRING" },
                                email: { type: "STRING" },
                                budget: { type: "STRING" },
                                property_type: { type: "STRING" },
                                location: { type: "STRING" },
                                timeline: { type: "STRING" }
                            }
                        }
                    },
                    {
                        name: "INITIATE_CALL",
                        description: "Initiate an outbound voice call to the user immediately. Use this when the user asks to be called.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                reason: { type: "STRING", description: "Reason for the call" }
                            }
                        }
                    }
                ]
            }
        ];

        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            systemInstruction: systemInstruction,
            tools: tools as any
        });

        const chat = model.startChat();

        // Check if voice note or text
        let promptText = userMessage;
        if (numMedia > 0 && mediaType?.startsWith('audio/') && mediaBuffer) {
            isVoiceResponse = true;
            console.log("Processing audio message...");
            promptText = "[USER SENT A VOICE NOTE - PLEASE REPLY CONFIRMING RECEIPT AND ASK TO CONTINUE IN TEXT OR SCHEDULE A CALL]";
        }

        console.log("Sending prompt to Gemini:", promptText);
        const result = await chat.sendMessage(promptText);
        const response = await result.response;

        let functionCalls = response.functionCalls();
        let textResponse = response.text();

        // Handle function calls loop (max 3 turns)
        let turns = 0;
        while (functionCalls && functionCalls.length > 0 && turns < 3) {
            turns++;
            const parts = [];
            for (const call of functionCalls) {
                const name = call.name;
                const args = call.args;
                let toolResult = "";

                if (name === 'RAG_QUERY_TOOL') {
                    toolResult = await queryRAG((args as any).query);
                } else if (name === 'SEARCH_WEB_TOOL') {
                    toolResult = await searchWeb((args as any).query);
                } else if (name === 'UPDATE_LEAD') {
                    console.log("UPDATE_LEAD called with:", JSON.stringify(args));
                    if (leadId) {
                        const { error } = await supabase.from('leads').update(args).eq('id', leadId);
                        if (error) {
                            console.error("Error updating lead:", error);
                            toolResult = "Error updating lead.";
                        } else {
                            console.log("Lead updated successfully.");
                            toolResult = "Lead updated successfully.";
                        }
                    } else {
                        toolResult = "No lead ID found.";
                    }
                } else if (name === 'INITIATE_CALL') {
                    console.log("INITIATE_CALL called");
                    const callStarted = await initiateVapiCall(fromNumber);
                    if (callStarted) {
                        toolResult = "Call initiated successfully.";
                    } else {
                        toolResult = "Failed to initiate call.";
                    }
                }

                parts.push({
                    functionResponse: {
                        name: name,
                        response: {
                            name: name,
                            content: toolResult
                        }
                    }
                });
            }

            // Send tool results back to model
            console.log("Sending tool results back to Gemini...");
            const nextResult = await chat.sendMessage(parts);
            const nextResponse = await nextResult.response;
            functionCalls = nextResponse.functionCalls();
            textResponse = nextResponse.text();
        }

        responseText = textResponse || "I didn't quite catch that. Could you repeat?";

        // --- SUPABASE: Log AI Response ---
        if (leadId && responseText) {
            let messageType = 'Message';
            let meta = null;

            if (isVoiceResponse) {
                messageType = 'Voice';
                meta = `https://${host}/.netlify/functions/tts?text=${encodeURIComponent(responseText)}`;
            }

            await supabase.from('messages').insert({
                lead_id: leadId,
                type: messageType,
                sender: 'AURO_AI',
                content: responseText,
                meta: meta
            });
        }

        let twiml = `
      <Response>
        <Message>
          <Body>${responseText}</Body>
    `;

        if (isVoiceResponse) {
            const ttsUrl = `https://${host}/.netlify/functions/tts?text=${encodeURIComponent(responseText)}`;
            twiml += `<Media>${ttsUrl}</Media>`;
        }

        twiml += `
        </Message>
      </Response>
    `;

        console.log("Generated TwiML:", twiml);

        return {
            statusCode: 200,
            body: twiml,
            headers: { "Content-Type": "text/xml" }
        };

    } catch (error) {
        console.error("Error processing WhatsApp request:", error);
        return { statusCode: 500, body: "<Response><Message>Error processing request</Message></Response>", headers: { "Content-Type": "text/xml" } };
    }
};

export { handler };
