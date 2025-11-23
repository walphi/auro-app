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
            ]
        });

let finalResponse = "";

if (numMedia > 0 && mediaBuffer && mediaType) {
    // Handle Media (Voice/Image) with Gemini
    const audioBase64 = mediaBuffer.toString('base64');

    // Send audio/image to chat
    const result = await chat.sendMessage([
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
                console.log("UPDATE_LEAD called with:", JSON.stringify(args));
                if (leadId) {
                    const { error } = await supabase.from('leads').update(args).eq('id', leadId);
                    if (error) {
                        console.error("Error updating lead:", error);
                        toolResult = "Error updating lead.";
                    } else {
                        console.log("Lead updated successfully.");
                        toolResult = "Lead updated.";
                    }
                } else {
                    toolResult = "No lead ID found.";
                }
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
                console.log("UPDATE_LEAD called with:", JSON.stringify(args));
                if (leadId) {
                    const { error } = await supabase.from('leads').update(args).eq('id', leadId);
                    if (error) {
                        console.error("Error updating lead:", error);
                        toolResult = "Error updating lead.";
                    } else {
                        console.log("Lead updated successfully.");
                        toolResult = "Lead updated.";
                    }
                } else {
                    toolResult = "No lead ID found.";
                }
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
