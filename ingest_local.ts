import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function chunkText(text: string, size: number = 800, overlap: number = 100): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + size, text.length);
        chunks.push(text.substring(start, end));
        start += size - overlap;
    }
    return chunks;
}

async function ingestFile(filePath: string, folderId: string, sourceName: string) {
    console.log(`Ingesting ${filePath} into ${folderId}...`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const chunks = chunkText(content);

    // 1. Create Document Record
    const { data: doc, error: docError } = await supabase
        .from('knowledge_base')
        .insert({
            tenant_id: 1,
            folder_id: folderId,
            source_name: sourceName,
            type: 'text',
            content: content,  // Store full content for reference
            metadata: { contentLength: content.length }
        })
        .select()
        .single();

    if (docError) {
        console.error('Error creating doc:', docError);
        return;
    }

    console.log(`Created doc ${doc.id} with ${chunks.length} chunks.`);

    // 2. Generate Embeddings & Insert Chunks
    const { embedText } = require("./lib/rag/embeddingClient");

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        try {
            const embedding = await embedText(chunk, {
                taskType: 'RETRIEVAL_DOCUMENT',
                outputDimensionality: 768
            });

            if (!embedding) {
                console.error(`Error embedding chunk ${i}: Returned null`);
                continue;
            }

            await supabase.from('rag_chunks').insert({
                tenant_id: 1,
                document_id: doc.id,
                folder_id: folderId,
                client_id: 'demo', // Legacy field
                content: chunk,
                embedding: embedding,
                metadata: { index: i, source: sourceName }
            });

            process.stdout.write('.');
        } catch (e: any) {
            // If creating a 10s wait solves "429 Too Many Requests" from Gemini, add it logic here
            console.error(`Error embedding chunk ${i}:`, e.message);
        }
    }
    console.log('\nDone!');
}

async function main() {
    await ingestFile('provident_full_history.txt', 'campaign_docs', 'Provident Q1 2025 Strategy');
    await ingestFile('market_report_q3_2025.txt', 'market_reports', 'Dubai Market Report Q3 2025');
    await ingestFile('market_report_2025_outlook.txt', 'market_reports', 'Dubai Market Outlook 2025');
}

main();
