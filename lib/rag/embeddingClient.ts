import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const DEFAULT_MODEL = "models/embedding-001";
const EMBEDDING_MODEL = process.env.RAG_EMBEDDING_MODEL || DEFAULT_MODEL;

/**
 * Centralized helper for text embeddings via Gemini.
 * Uses a robust configuration to prevent silent regressions.
 */
export async function embedText(text: string, options: { taskType?: string, outputDimensionality?: number } = {}): Promise<number[] | null> {
    const { taskType = 'RETRIEVAL_DOCUMENT', outputDimensionality = 768 } = options;

    if (!text || text.trim().length === 0) return null;

    try {
        const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

        // Note: some older models like embedding-001 might not support outputDimensionality 
        // or embedContent for v1beta in certain ways. We use a safe structure.
        const result = await model.embedContent({
            content: { role: 'user', parts: [{ text: text.substring(0, 8000) }] },
            taskType: taskType as any,
            ...(EMBEDDING_MODEL.includes('004') ? { outputDimensionality } : {})
        } as any);

        if (!result.embedding || !result.embedding.values) {
            throw new Error("Empty embedding returned");
        }

        return result.embedding.values;
    } catch (err: any) {
        console.error(`[RAG_EMBEDDING_ERROR] model=${EMBEDDING_MODEL} message=${err.message}`);

        // HOOK FOR PERPLEXITY FALLBACK:
        // If Gemini embedding fails, we could potentially fallback to a keyword-only search 
        // or trigger a Perplexity search directly here if we had the API key and client wired.
        // For now, we return null to allow the caller to degrade gracefully.

        return null;
    }
}

/**
 * Generate embeddings for a batch of strings
 */
export async function embedTextBatch(texts: string[]): Promise<(number[] | null)[]> {
    return Promise.all(texts.map(text => embedText(text)));
}
