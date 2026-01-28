import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface Chunk {
    text: string;
    index: number;
    metadata: any;
}

/**
 * Split text into chunks for embedding
 */
export function chunkText(text: string, options: { chunkSize?: number, overlap?: number } = {}): Chunk[] {
    const { chunkSize = 1000, overlap = 200 } = options;
    const chunks: Chunk[] = [];
    let start = 0;
    let index = 0;

    while (start < text.length) {
        let end = Math.min(start + chunkSize, text.length);

        // Try to break at sentence boundary
        if (end < text.length) {
            const breakPoint = text.lastIndexOf('. ', end);
            if (breakPoint > start + (chunkSize / 2)) {
                end = breakPoint + 1;
            }
        }

        const content = text.slice(start, end).trim();
        if (content.length > 0) {
            chunks.push({
                text: content,
                index: index++,
                metadata: { char_start: start, char_end: end }
            });
        }

        start = end - overlap;
        if (end >= text.length || start >= text.length || start < 0) break;
        // Safety: ensure we always move forward
        if (start <= chunks[chunks.length - 1].metadata.char_start) {
            start = end;
        }
    }

    return chunks;
}

/**
 * Generate embedding for text via Gemini API
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        console.error('[RAG-Utils] GEMINI_API_KEY not configured');
        return null;
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: { parts: [{ text: text.substring(0, 4000) }] }
                })
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[RAG-Utils] Gemini API error: ${response.status} - ${errText}`);
            return null;
        }

        const result = await response.json();
        return result.embedding?.values || null;
    } catch (err: any) {
        console.error('[RAG-Utils] Embedding error:', err.message);
        return null;
    }
}

/**
 * Generate embeddings for a batch of strings
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<(number[] | null)[]> {
    // Note: Gemini text-embedding-004 supports batching, but for simplicity and robustness
    // we'll process them with Promise.all for now.
    return Promise.all(texts.map(text => generateEmbedding(text)));
}
