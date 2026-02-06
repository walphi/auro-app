import { GoogleGenerativeAI } from '@google/generative-ai';

// Helper to get genAI instance lazily to ensure environment variables are loaded
let genAIInstance: GoogleGenerativeAI | null = null;
function getGenAI() {
    if (!genAIInstance) {
        const apiKey = process.env.GEMINI_API_KEY || "";
        genAIInstance = new GoogleGenerativeAI(apiKey);
    }
    return genAIInstance;
}

// Default to gemini-embedding-001 for v1beta compatibility. 
// Note: This model supports outputDimensionality down to 768.
const DEFAULT_MODEL = "models/gemini-embedding-001";
const EMBEDDING_MODEL = process.env.RAG_EMBEDDING_MODEL || DEFAULT_MODEL;

/**
 * List all models that support 'embedContent' for debugging.
 */
export async function listAvailableEmbeddingModels() {
    try {
        const genAI = getGenAI();
        // Fallback discovery via manual naming if listModels is restricted
        console.log(`[RAG_EMBEDDING_DISCOVERY] Checking capabilities...`);

        // Note: SDK-based listModels is often restricted or version-dependent.
        // We log the current config as part of discovery.
        console.log(`[RAG_EMBEDDING_DISCOVERY] current_default=${DEFAULT_MODEL} configured=${EMBEDDING_MODEL}`);

        return [DEFAULT_MODEL]; // Minimal implementation as requested
    } catch (err: any) {
        console.error(`[RAG_EMBEDDING_DISCOVERY_ERROR] message=${err.message}`);
        return [];
    }
}

/**
 * Centralized helper for text embeddings via Gemini.
 * Uses a robust configuration to prevent silent regressions.
 */
export async function embedText(text: string, options: { taskType?: string, outputDimensionality?: number } = {}): Promise<number[] | null> {
    const { taskType = 'RETRIEVAL_DOCUMENT', outputDimensionality = 768 } = options;

    if (!text || text.trim().length === 0) return null;

    let modelId = EMBEDDING_MODEL;

    // Normalize model name (ensure 'models/' prefix)
    if (!modelId.startsWith('models/')) {
        modelId = `models/${modelId}`;
    }

    try {
        const genAI = getGenAI();
        const model = genAI.getGenerativeModel({ model: modelId });

        // We attempt to pass outputDimensionality if provided.
        // gemini-embedding-001 (v1beta) and text-embedding-004 support it.
        const result = await model.embedContent({
            content: { role: 'user', parts: [{ text: text.substring(0, 8000) }] },
            taskType: taskType as any,
            outputDimensionality: outputDimensionality
        } as any);

        if (!result.embedding || !result.embedding.values) {
            throw new Error("Empty embedding returned");
        }

        return result.embedding.values;
    } catch (err: any) {
        console.error(`[RAG_EMBEDDING_ERROR] model=${modelId} message=${err.message}`);

        // Fallback check: If the user requested 'embedding-001' and it failed, 
        // maybe they needed 'gemini-embedding-001' or vice-versa.
        // But for now, we just log and return null for the Perplexity hook.

        // HOOK FOR PERPLEXITY FALLBACK:
        // If Gemini embedding fails, allow the caller to degrade gracefully.
        return null;
    }
}

/**
 * Generate embeddings for a batch of strings
 */
export async function embedTextBatch(texts: string[]): Promise<(number[] | null)[]> {
    return Promise.all(texts.map(text => embedText(text)));
}
