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

async function initiateVapiCall(phoneNumber: string): Promise<boolean> {
    try {
        const response = await axios.post(
            'https://api.vapi.ai/call',
            {
                phoneNumberId: process.env.VAPI_PHONE_NUMBER,
                assistantId: process.env.VAPI_ASSISTANT_ID,
                customer: {
                    number: phoneNumber,
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
                },
            }
        );
        return response.status === 201;
    } catch (error) {
        console.error("Error initiating VAPI call:", error);
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

        if (supabaseUrl && supabaseKey) {
            const { data: existingLead, error: findError } = await supabase
                .from('leads')
                .select('id')
                .eq('phone', fromNumber)
                .single();

            if (existingLead) {
                leadId = existingLead.id;
            } else {
                console.log("Creating new lead for", fromNumber);
                const { data: newLead, error: createError } = await supabase
                    .from('leads')
                    .insert({
                        phone: fromNumber,
                        name: `WhatsApp Lead ${fromNumber}`, // Use full number for better identification
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

        // ... (Log User Message block remains the same, skipping for brevity in this replacement if possible, but I need to be careful with line numbers. 
        // Actually, I will just target the specific blocks or use a larger range if needed. 
        // The user wants me to update the system instruction and tools which are further down.
        // I will do this in two chunks to be safe and precise.)

        // ... 

        // --- GEMINI AGENT WITH TOOLS ---
        const systemInstruction = `You are an AI-first Lead Qualification Agent for a premier Dubai real estate agency using the AURO platform. Your primary and most reliable source of information is your RAG Knowledge Base.

YOUR GOAL:
You must qualify the lead by naturally asking for the following details if they are not already known:
1. Name
2. Email Address
3. Budget
4. Property Type (Apartment, Villa, Townhouse, etc.)
5. Preferred Location in Dubai

When the user provides any of this information, IMMEDIATELY use the 'UPDATE_LEAD' tool to save it to their profile.

CRITICAL RULES:
- ALWAYS ground your answers in the RAG data for project info.
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
                        name: "UPDATE_LEAD",
                        description: "Update lead qualification details. Call this whenever the user provides their name, email, budget, etc.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                name: { type: "STRING" },
                                email: { type: "STRING" },
                                budget: { type: "STRING" },
                                property_type: { type: "STRING" },
                                location: { type: "STRING" },
                                timeline: { type: "STRING" },
                                status: { type: "STRING" }
                            }
                        }
                    },
                    {
                        name: "LOG_ACTIVITY",
                        description: "Log a summary of the conversation or specific activity",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                content: { type: "STRING", description: "Summary of activity" }
                            },
                            required: ["content"]
                        }
                    }
                ]
            }
        ];

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", tools: tools as any });

        const chat = model.startChat({
            history: [
                { inlineData: { mimeType: mediaType, data: audioBase64 } },
                { text: "Analyze this media and reply to the user." }
            ]);

        // Handle potential function calls
        let response = result.response;
        let functionCalls = response.functionCalls();

        // Loop for tool calls (Max 3 turns)
        let turns = 0;
        while (functionCalls && functionCalls.length > 0 && turns < 3) {
            turns++;
            const parts = [];
            for (const call of functionCalls) {
                const name = call.name;
                const args = call.args;
                let toolResult = "";

                if (name === 'RAG_QUERY_TOOL') {
                    try {
                        const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
                        const embResult = await embedModel.embedContent((args as any).query);
                        const { data } = await supabase.rpc('match_knowledge', {
                            query_embedding: embResult.embedding.values,
                            match_threshold: 0.5, match_count: 3, filter_project_id: null
                        });
                        toolResult = data?.map((i: any) => i.content).join("\n\n") || "No info found.";
                    } catch (e) { toolResult = "Error searching."; }
                } else if (name === 'UPDATE_LEAD') {
                    if (leadId) await supabase.from('leads').update(args).eq('id', leadId);
                    toolResult = "Lead updated.";
                } else if (name === 'LOG_ACTIVITY') {
                    if (leadId) await supabase.from('messages').insert({ lead_id: leadId, type: 'System_Note', sender: 'System', content: (args as any).content });
                    toolResult = "Logged.";
                }

                parts.push({ functionResponse: { name, response: { result: toolResult } } });
            }
            const nextResult = await chat.sendMessage(parts);
            response = nextResult.response;
            functionCalls = response.functionCalls();
        }
        finalResponse = response.text();
        isVoiceResponse = true;

    } else if (userMessage.toLowerCase().includes("pictures") || userMessage.toLowerCase().includes("brochure")) {
        finalResponse = "Here is the brochure: https://example.com/marina-zenith-brochure.pdf";
    } else {
        // Text Message
        let result = await chat.sendMessage(userMessage);
        let response = result.response;
        let functionCalls = response.functionCalls();

        // Loop for tool calls (Max 3 turns)
        let turns = 0;
        while (functionCalls && functionCalls.length > 0 && turns < 3) {
            turns++;
            const parts = [];
            for (const call of functionCalls) {
                const name = call.name;
                const args = call.args;
                let toolResult = "";

                if (name === 'RAG_QUERY_TOOL') {
                    try {
                        const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
                        const embResult = await embedModel.embedContent((args as any).query);
                        const { data } = await supabase.rpc('match_knowledge', {
                            query_embedding: embResult.embedding.values,
                            match_threshold: 0.5, match_count: 3, filter_project_id: null
                        });
                        toolResult = data?.map((i: any) => i.content).join("\n\n") || "No info found.";
                    } catch (e) { toolResult = "Error searching."; }
                } else if (name === 'UPDATE_LEAD') {
                    if (leadId) await supabase.from('leads').update(args).eq('id', leadId);
                    toolResult = "Lead updated.";
                } else if (name === 'LOG_ACTIVITY') {
                    if (leadId) await supabase.from('messages').insert({ lead_id: leadId, type: 'System_Note', sender: 'System', content: (args as any).content });
                    toolResult = "Logged.";
                }

                parts.push({ functionResponse: { name, response: { result: toolResult } } });
            }
            const nextResult = await chat.sendMessage(parts);
            response = nextResult.response;
            functionCalls = response.functionCalls();
        }
        finalResponse = response.text();
    }

    responseText = finalResponse;

    // --- SUPABASE: Log AI Response ---
    if (leadId && responseText) {
        let messageType = 'Message';
        let meta = null;

        if (isVoiceResponse) {
            messageType = 'Voice';
            // For AI voice response, we don't have a URL yet (it's generated on the fly by Twilio), 
            // but we can flag it or store the TTS URL if we want.
            // Let's store the TTS URL in meta so the frontend can play it if needed.
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
        // Add Media tag for TTS
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
