import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as querystring from "querystring";
import axios from "axios";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const handler: Handler = async (event) => {
    try {
        if (event.httpMethod !== "POST") {
            return { statusCode: 405, body: "Method Not Allowed" };
        }

        const body = querystring.parse(event.body || "");
        const userMessage = (body.Body as string) || "";
        const numMedia = parseInt((body.NumMedia as string) || "0");
        const host = event.headers.host || "auro-app.netlify.app";

        let responseText = "";
        let isVoiceResponse = false;

        if (numMedia > 0) {
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
