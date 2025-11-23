import { Handler } from "@netlify/functions";
import * as googleTTS from "google-tts-api";
import axios from "axios";


const handler: Handler = async (event) => {
    try {
        let text = event.queryStringParameters?.text || "Hello";
        if (text.length > 200) text = text.substring(0, 197) + "...";

        // Get Google TTS URL
        const url = googleTTS.getAudioUrl(text, {
            lang: 'en',
            slow: false,
            host: 'https://translate.google.com',
        });

        // Fetch the audio content
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const audioBuffer = Buffer.from(response.data);

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "audio/mpeg",
                "Content-Length": audioBuffer.length.toString(),
            },
            body: audioBuffer.toString('base64'),
            isBase64Encoded: true,
        };

    } catch (error) {
        console.error("TTS Error:", error);
        return { statusCode: 500, body: "Error generating audio" };
    }
};

export { handler };
