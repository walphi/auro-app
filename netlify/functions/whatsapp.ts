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
                const { data: newLead, error: createError } = await supabase
                    .from('leads')
                    .insert({
                        phone: fromNumber,
                        name: `WhatsApp User ${fromNumber.slice(-4)}`,
                        status: 'New',
                        custom_field_1: 'Source: WhatsApp'
                    })
                    .select('id')
                    .single();

                if (newLead) leadId = newLead.id;
                if (createError) console.error("Error creating lead:", createError);
            }
        }

        // --- SUPABASE: Log User Message ---
        if (leadId) {
            if (numMedia > 0) {
                const mediaType = body.MediaContentType0?.toString();
                const mediaUrl = body.MediaUrl0 as string;

                if (mediaType?.startsWith('audio/')) {
                    // Log Voice Note
                    await supabase.from('messages').insert({
                        lead_id: leadId,
                        type: 'Voice',
                        sender: 'Lead',
                        content: 'Voice Note',
                        meta: mediaUrl
                    });
                } else if (mediaType?.startsWith('image/')) {
                    // Log Image
                    await supabase.from('messages').insert({
                        lead_id: leadId,
                        type: 'Image',
                        sender: 'Lead',
                        content: userMessage || 'Image Shared',
                        meta: mediaUrl
                    });
                }
            } else if (userMessage) {
                // Log Text Message
                await supabase.from('messages').insert({
                    lead_id: leadId,
                    type: 'Message',
                    sender: 'Lead',
                    content: userMessage
                });
            }
        }

        let responseText = "";
        let isVoiceResponse = false;

        const lowerCaseMessage = userMessage.toLowerCase();
        const callMeTrigger = lowerCaseMessage.includes('call me') ||
            lowerCaseMessage.includes('speak to agent') ||
            lowerCaseMessage.includes('voice call') ||
            lowerCaseMessage === 'call';

        if (callMeTrigger) {
            const success = await initiateVapiCall(fromNumber);
            if (success) {
                responseText = "📞 Thanks! An **AURO** voice agent is calling you now at this number. Please answer your phone to connect!";
            } else {
                responseText = "I'm sorry, I couldn't initiate the voice call right now. Please try again later or type 'help'.";
            }
        }

        // --- GEMINI AGENT WITH TOOLS ---
        const systemInstruction = `You are an AI-first Lead Qualification Agent for a premier Dubai real estate agency using the AURO platform. Your primary and most reliable source of information is your RAG Knowledge Base, which contains the latest, client-approved details on Project Brochures, Pricing Sheets, Payment Plans, and Community Regulations specific to Dubai (DLD, Service Fees, etc.).

CRITICAL RULE:
ALWAYS ground your answers in the RAG data, especially for figures like pricing and payment plans.
NEVER invent information. If the RAG data does not contain the answer, state professionally: 'That specific detail is currently with our sales team; I will ensure the human agent follows up with the exact information.'
Maintain a professional, knowledgeable, and polite tone, recognizing the high-value nature of the Dubai real estate market.
Keep your final response under 50 words for WhatsApp.`;

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
                        description: "Update lead qualification details (budget, property type, timeline, etc.)",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                budget: { type: "STRING" },
                                property_type: { type: "STRING" },
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
                { role: "user", parts: [{ text: systemInstruction }] },
                { role: "model", parts: [{ text: "Understood. I am ready to assist." }] }
            ]
        });

        let finalResponse = "";
        let currentMessage = userMessage;

        // If voice note, we already have the text in userMessage? 
        // Wait, the previous code handled voice note by generating text from audio.
        // I need to handle that.

        if (numMedia > 0) {
            // ... (Existing voice note logic to get text would be here, but I am replacing the block)
            // The previous code did: result = await model.generateContent([ { inlineData... }, { text: prompt } ])
            // This is tricky to combine with chat. 
            // For now, let's assume userMessage is text. If it was audio, I need to transcribe it first or pass it to chat.
            // Gemini 2.0 Flash supports audio input.

            const mediaUrl = body.MediaUrl0 as string;
            const mediaType = body.MediaContentType0 as string;

            const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
            const audioResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer', headers: { Authorization: `Basic ${auth}` } });
            const audioBase64 = Buffer.from(audioResponse.data).toString('base64');

            // Send audio to chat
            const result = await chat.sendMessage([
                { inlineData: { mimeType: mediaType, data: audioBase64 } },
                { text: "Listen to this voice note and reply." }
            ]);

            // Handle potential function calls from audio input
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
                        // ... RAG Logic ...
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
