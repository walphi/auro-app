import { Handler } from "@netlify/functions";
import OpenAI from "openai";

const handler: Handler = async (event) => {
    try {
        const text = event.queryStringParameters?.text;
        if (!text) {
            return {
                statusCode: 400,
                body: "Missing 'text' query parameter"
            };
        }

        console.log(`[TTS] Generating OpenAI Audio (Onyx) for: "${text.substring(0, 50)}..."`);

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("Missing OPENAI_API_KEY");
        }

        const openai = new OpenAI({ apiKey: apiKey });

        // Generate speech using OpenAI TTS HD
        const mp3 = await openai.audio.speech.create({
            model: "tts-1-hd",
            voice: "onyx", // 'onyx' is deep and professional, closest to 'Elliot'
            input: text,
        });

        // Get the raw buffer
        const buffer = Buffer.from(await mp3.arrayBuffer());

        console.log(`[TTS] Generated Audio Length: ${buffer.length} bytes`);

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "audio/mpeg",
                "Content-Length": buffer.length.toString(),
                "Cache-Control": "public, max-age=31536000, immutable"
            },
            body: buffer.toString('base64'),
            isBase64Encoded: true
        };

    } catch (error: any) {
        console.error("[TTS] Error:", error.message);

        return {
            statusCode: 500,
            body: JSON.stringify({ error: "TTS Generation Failed", details: error.message })
        };
    }
};

export { handler };
