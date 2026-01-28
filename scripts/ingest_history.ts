
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { chunkText, generateEmbedding } from '../lib/rag/rag-utils';
import { RAG_CONFIG } from '../lib/rag/prompts';

// Load environmental variables from .env.local
dotenv.config({ path: '.env.local' });
dotenv.config(); // Fallback to .env

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // Robust argument parsing
    const args = process.argv.slice(2);
    let tenantId: number | null = null;
    let filePath: string | null = null;

    // Try to find by flags
    const tenantIdIdx = args.indexOf('--tenant-id');
    const fileIdx = args.indexOf('--file');

    if (tenantIdIdx !== -1 && args[tenantIdIdx + 1]) {
        tenantId = parseInt(args[tenantIdIdx + 1]);
    }
    if (fileIdx !== -1 && args[fileIdx + 1]) {
        filePath = args[fileIdx + 1];
    }

    // Fallback to positional arguments if flags not found
    if (tenantId === null && args.length >= 1) {
        tenantId = parseInt(args[0]);
    }
    if (filePath === null && args.length >= 2) {
        filePath = args[1];
    }

    if (tenantId === null || isNaN(tenantId) || filePath === null) {
        console.error('Usage: npm run ingest:history -- --tenant-id <id> --file <path>');
        console.error('Fallback: npm run ingest:history -- <id> <path>');
        console.log('Received args:', args);
        process.exit(1);
    }

    if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found at ${filePath}`);
        process.exit(1);
    }

    console.log(`[Ingest] Starting ingestion for Tenant ${tenantId} from ${filePath}...`);

    const content = fs.readFileSync(filePath, 'utf-8');
    const filename = path.basename(filePath);
    const folderId = 'agency_history';

    // 1. Insert into knowledge_base
    const { data: kbDoc, error: kbError } = await supabase
        .from('knowledge_base')
        .insert({
            tenant_id: tenantId,
            folder_id: folderId, // Use the new text column
            type: 'brand_story',
            source_name: filename,
            content: content,
            metadata: {
                source: 'provident_history',
                type: 'brand_story'
            },
            relevance_score: 5.0
        })
        .select('id')
        .single();

    if (kbError) {
        console.error('[Ingest] Error inserting into knowledge_base:', kbError.message);
        process.exit(1);
    }

    const docId = kbDoc.id;
    console.log(`[Ingest] Knowledge base entry created: ${docId}`);

    // 2. Chunk and Embed using tuned parameters for agency stories
    const chunks = chunkText(content, {
        chunkSize: RAG_CONFIG.agency.chunkSize,
        overlap: RAG_CONFIG.agency.overlap
    });
    console.log(`[Ingest] Generated ${chunks.length} chunks. Embedding...`);

    let successCount = 0;
    for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk.text);
        if (embedding) {
            const { error: chunkError } = await supabase
                .from('rag_chunks')
                .upsert({
                    chunk_id: `tenant_${tenantId}:${folderId}:${docId}:${chunk.index}`,
                    tenant_id: tenantId,
                    client_id: tenantId === 1 ? 'provident' : `tenant_${tenantId}`,
                    folder_id: folderId,
                    document_id: docId,
                    content: chunk.text,
                    embedding: embedding,
                    metadata: {
                        source: 'provident_history',
                        type: 'brand_story',
                        chunk_index: chunk.index,
                        source_name: filename
                    }
                }, { onConflict: 'chunk_id' });

            if (chunkError) {
                console.error(`[Ingest] Error inserting chunk ${chunk.index}:`, chunkError.message);
            } else {
                successCount++;
            }
        }
    }

    console.log(`[Ingest] Successfully ingested ${successCount}/${chunks.length} chunks for Tenant ${tenantId}.`);
}

main().catch(err => {
    console.error('[Ingest] Fatal error:', err);
    process.exit(1);
});
