import { Handler } from "@netlify/functions";
import axios from "axios";

const handler: Handler = async (event) => {
    try {
        const text = event.queryStringParameters?.text;

        if (!text) {
            return {
                statusCode: 400,
                body: "Missing 'text' query parameter"
            };
        }

        console.log(`[TTS] Generating audio for: "${text.substring(0, 50)}..."`);
        console.log(`[TTS] Using VAPI Key: ${process.env.VAPI_API_KEY ? 'Present' : 'Missing'}`);

        // Default Voice: Vapi 'Elliot' (Deep, Professional)
        // Based on provided JSON configuration
        const voiceId = "Elliot";

        const response = await axios.post(
            'https://api.vapi.ai/tts',
            {
                text: text,
                // Using the specific structure matches your assistant config
                model: {
                    provider: "vapi",
                    voiceId: voiceId
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg'
                },
                responseType: 'arraybuffer' // Important to get raw audio
            }
        );

        console.log(`[TTS] Generated ${response.data.length} bytes`);

        // Return MP3 directly
        return {
            statusCode: 200,
            headers: {
                "Content-Type": "audio/mpeg",
                "Content-Length": response.data.length.toString(),
                "Cache-Control": "public, max-age=31536000, immutable" // Cache forever, same text = same audio
            },
            body: Buffer.from(response.data).toString('base64'),
            isBase64Encoded: true
        };

    } catch (error: any) {
        console.error("[TTS] Error:", error.message);
        if (error.response) {
            console.error("[TTS] Vapi Response:", error.response.data.toString());
        }

        // Fallback: If Vapi fails, we don't want to break the app. 
        // We can return a 500, and the frontend/WhatsApp will just use text or fail gracefully.
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "TTS Generation Failed", details: error.message })
        };
    }
};

export { handler };
