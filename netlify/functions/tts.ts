import { Handler } from "@netlify/functions";
import * as googleTTS from "google-tts-api";

const handler: Handler = async (event) => {
    try {
        const text = event.queryStringParameters?.text || "Hello";

        // Generate MP3 url (Google TTS API returns a URL to the audio)
        // However, Twilio needs a direct audio file. 
        // google-tts-api provides getAudioUrl which returns a google translate url.
        // We can redirect to it, or fetch and stream it. 
        // Twilio <Media> follows redirects.

        const url = googleTTS.getAudioUrl(text, {
            lang: 'en',
            slow: false,
            host: 'https://translate.google.com',
        });

        return {
            statusCode: 302,
            headers: {
                Location: url,
            },
            body: "",
        };

    } catch (error) {
        console.error("TTS Error:", error);
        return { statusCode: 500, body: "Error generating audio" };
    }
};

export { handler };
