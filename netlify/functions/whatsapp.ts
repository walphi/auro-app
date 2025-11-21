import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as querystring from "querystring";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
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
        if (leadId && userMessage) {
            await supabase.from('messages').insert({
                lead_id: leadId,
                type: 'Message',
                sender: 'Lead',
                content: userMessage
            });
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
        } else if (numMedia > 0) {
            // Handle Voice Note
            const mediaUrl = body.MediaUrl0 as string;
            const mediaType = body.MediaContentType0 as string; // e.g. audio/ogg

            console.log(`Processing voice note: ${mediaUrl} (${mediaType})`);

            // Download audio with Basic Auth
            const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
            const audioResponse = await axios.get(mediaUrl, {
                responseType: 'arraybuffer',
                headers: {
                    Authorization: `Basic ${auth}`
                }
            });
            const audioBase64 = Buffer.from(audioResponse.data).toString('base64');

            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            const result = await model.generateContent([
                {
                    inlineData: {
                        mimeType: mediaType,
                        data: audioBase64
                    }
                },
                { text: "You are AURO, a Dubai real estate assistant. Listen to the user's voice note and reply with a short, professional answer (under 20 words) ending with a qualifying question." }
            ]);

            responseText = result.response.text();
            isVoiceResponse = true;


        } else if (userMessage.toLowerCase().includes("pictures") || userMessage.toLowerCase().includes("brochure")) {
            responseText = "Here is the brochure: https://example.com/marina-zenith-brochure.pdf";
        } else {
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const prompt = `You are AURO, a Dubai real estate assistant. The user asked: "${userMessage}". 
      Provide a short answer (under 20 words) and end with a qualifying question.`;

            const result = await model.generateContent(prompt);
            responseText = result.response.text();
        }

        // --- SUPABASE: Log AI Response ---
        if (leadId && responseText) {
            await supabase.from('messages').insert({
                lead_id: leadId,
                type: 'Message',
                sender: 'AURO_AI',
                content: responseText
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
