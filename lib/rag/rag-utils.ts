import { embedText, embedTextBatch } from './embeddingClient';

export interface Chunk {
    text: string;
    index: number;
    metadata: any;
}

/**
 * Split text into chunks for embedding
 * Improved: Respects Markdown headers and semantic section breaks
 */
export function chunkText(text: string, options: { chunkSize?: number, overlap?: number } = {}): Chunk[] {
    const { chunkSize = 1000, overlap = 200 } = options;

    // First, try to split by obvious semantic headers (Markdown style)
    // This keeps related sections together
    const sections = text.split(/\n(?=#{1,4} )/);

    const chunks: Chunk[] = [];
    let index = 0;

    for (const section of sections) {
        let currentPos = 0;

        // If a section is small enough, keep it as one chunk
        if (section.length <= chunkSize) {
            chunks.push({
                text: section.trim(),
                index: index++,
                metadata: { type: 'section' }
            });
            continue;
        }

        // If a section is too large, sub-divide it recursively
        while (currentPos < section.length) {
            let end = currentPos + chunkSize;

            if (end < section.length) {
                // Look for best break point within the last 30% of the chunk
                const searchRange = section.slice(currentPos + Math.floor(chunkSize * 0.7), end);

                // Try to split on paragraph, then sentence
                let breakIdx = searchRange.lastIndexOf('\n\n');
                if (breakIdx === -1) breakIdx = searchRange.lastIndexOf('\n');
                if (breakIdx === -1) breakIdx = searchRange.lastIndexOf('. ');

                if (breakIdx !== -1) {
                    end = currentPos + Math.floor(chunkSize * 0.7) + breakIdx + 1;
                }
            }

            const chunkText = section.slice(currentPos, end).trim();
            if (chunkText.length > 50) { // Avoid tiny fragments
                chunks.push({
                    text: chunkText,
                    index: index++,
                    metadata: { type: 'sub_section', char_start: currentPos, char_end: end }
                });
            }

            currentPos = end - overlap;
            if (currentPos >= section.length - 50) break; // End of section
        }
    }

    return chunks;
}

/**
 * Generate embedding for text via Gemini API
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
    return embedText(text, { taskType: 'RETRIEVAL_DOCUMENT' });
}

/**
 * Generate embeddings for a batch of strings
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<(number[] | null)[]> {
    return embedTextBatch(texts);
}
