import { GoogleGenerativeAI, ChatSession, Content, Part } from "@google/generative-ai";

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * MODELS DETECTED FROM PROJECT LISTING:
 * Primary: gemini-2.5-flash (Latest fast, versatile stable model)
 * Fallback: gemini-3.1-flash-lite (Latest low-cost fallback model)
 */
export const PRIMARY_MODEL_ID = "gemini-2.5-flash";
export const FALLBACK_MODEL_ID = "gemini-3.1-flash-lite";

export interface GeminiOptions {
    systemInstruction?: string;
    tools?: any[];
    history?: Content[];
    temperature?: number;
}

/**
 * Analytics counters for Gemini model usage
 * These are logged to help track quota usage and scaling issues
 */
export const GEMINI_ANALYTICS = {
    primary_success: 0,
    primary_429: 0,
    primary_404: 0,
    primary_5xx: 0,
    fallback_used: 0,
    fallback_success: 0,
    total_failure: 0
};

/**
 * Log analytics event with timestamp
 */
function logAnalytics(event: string, details?: any) {
    const timestamp = new Date().toISOString();
    console.log(`[GEMINI_ANALYTICS] ${timestamp} - ${event}`, details || '');
}

/**
 * Helper to call Gemini with a single-turn message or audio.
 * Implements retry with backoff and model fallback.
 */
export async function callGemini(
    prompt: string | (string | Part)[],
    options: GeminiOptions = {}
): Promise<string> {
    try {
        return await executeWithFallback(async (modelId) => {
            const model = genAI.getGenerativeModel({
                model: modelId,
                systemInstruction: options.systemInstruction,
                tools: options.tools as any
            });

            const result = await model.generateContent(prompt);
            return result.response.text();
        });
    } catch (error: any) {
        if (error.message === "GEMINI_404_FAILURE") {
            return "I’m being updated right now, please try again in a few minutes.";
        }
        throw error;
    }
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
        try {
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
        } catch (error: any) {
            if (error.message === "GEMINI_404_FAILURE") {
                const text = "I’m being updated right now, please try again in a few minutes.";
                
                // Maintain the alternating user/model history constraint
                this.history.push({
                    role: 'user',
                    parts: Array.isArray(parts) ? (typeof parts[0] === 'string' ? [{ text: parts.join(' ') }] : parts as Part[]) : [{ text: parts as string }]
                });
                this.history.push({
                    role: 'model',
                    parts: [{ text }]
                });

                return { text };
            }
            throw error;
        }
    }
}

/**
 * Core execution engine with retry and fallback
 * Max 3 attempts total: 2 on primary (initial + retry), 1 on fallback
 * Prevents long-tail latency in WhatsApp by capping retries
 */
/**
 * Helper to determine if an error is a 404/not found error
 */
function isNotFoundError(error: any): boolean {
    const status = error.status || error.response?.status;
    if (status === 404 || status === '404') {
        return true;
    }
    const msg = String(error.message || '').toLowerCase();
    return msg.includes('404') || msg.includes('not found') || msg.includes('no longer available');
}

/**
 * Core execution engine with retry and fallback
 * Max 3 attempts total: 2 on primary (initial + retry), 1 on fallback
 * Prevents long-tail latency in WhatsApp by capping retries
 */
async function executeWithFallback<T>(
    operation: (modelId: string) => Promise<T>
): Promise<T> {
    let lastError: any;
    let attemptCount = 0;
    const MAX_TOTAL_ATTEMPTS = 3;
    let primary404 = false;
    let fallback404 = false;

    // 1. Try Primary Model (Attempt 1)
    attemptCount++;
    try {
        console.log(`[GEMINI] Attempt ${attemptCount}/${MAX_TOTAL_ATTEMPTS}: Using primary model: ${PRIMARY_MODEL_ID}`);
        const result = await operation(PRIMARY_MODEL_ID);
        GEMINI_ANALYTICS.primary_success++;
        logAnalytics('primary_success', { model: PRIMARY_MODEL_ID, attempt: attemptCount });
        return result;
    } catch (error: any) {
        lastError = error;
        const status = error.status || (error.response?.status) || 'unknown';
        const errorCode = error.code || error.message || 'unknown_error';

        console.error(`[GEMINI] Primary model failed (attempt ${attemptCount}): status=${status}, code=${errorCode}`);

        const is404 = isNotFoundError(error);
        if (is404) {
            primary404 = true;
        }

        // Track specific error types
        if (status === 429) {
            GEMINI_ANALYTICS.primary_429++;
            logAnalytics('primary_429', { model: PRIMARY_MODEL_ID, errorCode });
        } else if (is404) {
            GEMINI_ANALYTICS.primary_404++;
            logAnalytics('primary_404', { model: PRIMARY_MODEL_ID, errorCode });
        } else if (status >= 500 && status < 600) {
            GEMINI_ANALYTICS.primary_5xx++;
            logAnalytics('primary_5xx', { model: PRIMARY_MODEL_ID, status, errorCode });
        }

        // 2. Retry Primary Model for 429 (Attempt 2)
        if (status === 429 && attemptCount < MAX_TOTAL_ATTEMPTS - 1) {
            attemptCount++;
            console.warn(`[GEMINI] Attempt ${attemptCount}/${MAX_TOTAL_ATTEMPTS}: Retrying primary model after 429 (2s backoff)`);
            await new Promise(resolve => setTimeout(resolve, 2000));

            try {
                const result = await operation(PRIMARY_MODEL_ID);
                GEMINI_ANALYTICS.primary_success++;
                logAnalytics('primary_success_after_retry', { model: PRIMARY_MODEL_ID, attempt: attemptCount });
                return result;
            } catch (retryError: any) {
                lastError = retryError;
                const retryStatus = retryError.status || (retryError.response?.status) || 'unknown';
                const retryCode = retryError.code || retryError.message || 'unknown_error';
                console.error(`[GEMINI] Primary retry failed (attempt ${attemptCount}): status=${retryStatus}, code=${retryCode}`);
            }
        }
    }

    // 3. Try Fallback Model (Attempt 3)
    if (attemptCount < MAX_TOTAL_ATTEMPTS) {
        attemptCount++;
        const isLastErr404 = isNotFoundError(lastError);
        const fallbackReason = lastError.status === 429 ? '429 (rate limit)' :
            isLastErr404 ? '404 (not found)' :
                lastError.status >= 500 ? `${lastError.status} (server error)` :
                    `${lastError.status || 'unknown'} (${lastError.message || 'error'})`;

        console.log(`[GEMINI] Attempt ${attemptCount}/${MAX_TOTAL_ATTEMPTS}: Falling back due to ${fallbackReason}`);
        GEMINI_ANALYTICS.fallback_used++;
        logAnalytics('fallback_used', { reason: fallbackReason, model: FALLBACK_MODEL_ID });

        try {
            const result = await operation(FALLBACK_MODEL_ID);
            GEMINI_ANALYTICS.fallback_success++;
            logAnalytics('fallback_success', { model: FALLBACK_MODEL_ID, attempt: attemptCount });
            return result;
        } catch (fallbackError: any) {
            lastError = fallbackError;
            const fallbackStatus = fallbackError.status || (fallbackError.response?.status) || 'unknown';
            const fallbackCode = fallbackError.code || fallbackError.message || 'unknown_error';
            console.error(`[GEMINI] Fallback model failed (attempt ${attemptCount}): status=${fallbackStatus}, code=${fallbackCode}`);
            if (isNotFoundError(fallbackError)) {
                fallback404 = true;
            }
        }
    }

    // 4. Total Failure
    GEMINI_ANALYTICS.total_failure++;
    const finalStatus = lastError.status || 'unknown';
    const finalCode = lastError.code || lastError.message || 'unknown_error';
    logAnalytics('total_failure', {
        attempts: attemptCount,
        lastStatus: finalStatus,
        lastCode: finalCode,
        analytics: { ...GEMINI_ANALYTICS }
    });
    console.error(`[GEMINI] TOTAL FAILURE after ${attemptCount} attempts. Last error: status=${finalStatus}, code=${finalCode}`);
    console.error(`[GEMINI] Analytics snapshot:`, GEMINI_ANALYTICS);
    
    if (primary404 && fallback404) {
        throw new Error("GEMINI_404_FAILURE");
    }
    
    throw new Error("GEMINI_TOTAL_FAILURE");
}
