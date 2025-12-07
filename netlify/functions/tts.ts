import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const handler: Handler = async (event) => {
    try {
        const text = event.queryStringParameters?.text;
        if (!text) {
            return {
                statusCode: 400,
                body: "Missing 'text' query parameter"
            };
        }

        console.log(`[TTS] Generating Gemini Native Audio (Kore) for: "${text.substring(0, 50)}..."`);

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("Missing GEMINI_API_KEY");
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        // Use Gemini 2.0 Flash Experimental for native audio generation
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: "Kore"
                        }
                    }
                }
            } as any // Cast to any because SDK types might not be fully updated for this exp feature yet
        });

        // Prompt the model to speak the text
        const prompt = `Please read the following text clearly and naturally: "${text}"`;

        const result = await model.generateContent(prompt);
        const response = await result.response;

        // The audio content comes in parts
        // Typically response.candidates[0].content.parts[0].inlineData.data
        // But the SDK simplifies access. 
        // Let's check how the raw response looks or use the parts directly.

        // Standard SDK access usually allows extracting parts.
        // For Audio, it returns base64 string in inlineData.

        // We handle potential structure variations for experimental model
        const parts = response.candidates?.[0]?.content?.parts;
        let audioBase64 = null;

        if (parts) {
            for (const part of parts) {
                if (part.inlineData && part.inlineData.mimeType.startsWith('audio/')) {
                    audioBase64 = part.inlineData.data;
                    break;
                }
            }
        }

        if (!audioBase64) {
            throw new Error("No audio data returned from Gemini.");
        }

        console.log(`[TTS] Generated Audio Length: ${audioBase64.length} chars (base64)`);

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "audio/wav", // Gemini usually outputs WAV or PCM in a container
                "Content-Length": Buffer.from(audioBase64, 'base64').length.toString(),
                "Cache-Control": "public, max-age=31536000, immutable"
            },
            body: audioBase64, // response.text() is empty for Audio modality, we use the base64 from inlineData
            isBase64Encoded: true
        };

    } catch (error: any) {
        console.error("[TTS] Error:", error.message);
        if (error.response) {
            console.error("[TTS] Gemini Response Details:", JSON.stringify(error.response, null, 2));
        }

        return {
            statusCode: 500,
            body: JSON.stringify({ error: "TTS Generation Failed", details: error.message })
        };
    }
};

export { handler };
