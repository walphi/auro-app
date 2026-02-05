import { GoogleGenerativeAI, ChatSession, Content, Part } from "@google/generative-ai";

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * MODELS DETECTED FROM PROJECT LISTING:
 * Primary: gemini-2.0-flash-lite-001 (Fast, versatile, stable release)
 * Fallback: gemini-2.0-flash-001 (Standard stable version)
 */
export const PRIMARY_MODEL_ID = "gemini-2.0-flash-lite-001";
export const FALLBACK_MODEL_ID = "gemini-2.0-flash-001";

export interface GeminiOptions {
    systemInstruction?: string;
    tools?: any[];
    history?: Content[];
    temperature?: number;
}

/**
 * Helper to call Gemini with a single-turn message or audio.
 * Implements retry with backoff and model fallback.
 */
export async function callGemini(
    prompt: string | (string | Part)[],
    options: GeminiOptions = {}
): Promise<string> {
    return await executeWithFallback(async (modelId) => {
        const model = genAI.getGenerativeModel({
            model: modelId,
            systemInstruction: options.systemInstruction,
            tools: options.tools as any
        });

        const result = await model.generateContent(prompt);
        return result.response.text();
    });
}

/**
 * Robust Chat Session that handles its own history and fallback.
 * Keeps track of turns so it can re-apply them if falling back during a tool-calling session.
 */
export class RobustChat {
    private history: Content[];
    private options: GeminiOptions;

    constructor(options: GeminiOptions) {
        this.history = [...(options.history || [])];
        this.options = options;
    }

    async sendMessage(parts: string | (string | Part)[]): Promise<{ text: string; functionCalls?: any[] }> {
        const result = await executeWithFallback(async (modelId) => {
            const model = genAI.getGenerativeModel({
                model: modelId,
                systemInstruction: this.options.systemInstruction,
                tools: this.options.tools as any
            });

            // Re-start chat with latest history on every send to ensure fallback can reconstruct state
            const chat = model.startChat({
                history: this.history
            });

            const result = await chat.sendMessage(parts);
            const response = result.response;

            return {
                text: response.text(),
                functionCalls: response.functionCalls()
            };
        });

        // If successful, we MUST update our local history because the internal 'chat' object is discarded
        // We add the user turn
        this.history.push({
            role: 'user',
            parts: Array.isArray(parts) ? (typeof parts[0] === 'string' ? [{ text: parts.join(' ') }] : parts as Part[]) : [{ text: parts as string }]
        });

        // We add the model turn
        const modelParts: any[] = [{ text: result.text }];
        if (result.functionCalls) {
            result.functionCalls.forEach(call => {
                modelParts.push({ functionCall: call });
            });
        }
        this.history.push({
            role: 'model',
            parts: modelParts
        });

        return result;
    }
}

/**
 * Core execution engine with retry and fallback
 */
async function executeWithFallback<T>(
    operation: (modelId: string) => Promise<T>
): Promise<T> {
    let lastError: any;

    // 1. Try Primary Model
    try {
        console.log(`[GEMINI] Using primary model: ${PRIMARY_MODEL_ID}`);
        return await operation(PRIMARY_MODEL_ID);
    } catch (error: any) {
        lastError = error;
        const status = error.status || (error.response ? error.response.status : null);

        // Retry logic for 429
        if (status === 429) {
            console.warn(`[GEMINI] Primary model 429, retrying with backoff...`);
            await new Promise(resolve => setTimeout(resolve, 2000));

            try {
                return await operation(PRIMARY_MODEL_ID);
            } catch (retryError: any) {
                lastError = retryError;
                console.error(`[GEMINI] Retry failed for primary model.`);
            }
        }
    }

    // 2. Try Fallback Model
    try {
        console.log(`[GEMINI] Falling back to model: ${FALLBACK_MODEL_ID}`);
        return await operation(FALLBACK_MODEL_ID);
    } catch (fallbackError: any) {
        console.error(`[GEMINI] Fallback model also failed: ${fallbackError.message}`);
        throw new Error("GEMINI_TOTAL_FAILURE");
    }
}
