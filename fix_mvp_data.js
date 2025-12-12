import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import fs from 'fs';

// Load Environment
const envPath = path.resolve('auro-rag-mcp', '.env');
const rootEnvPath = path.resolve('.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
if (fs.existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath });

// Configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiKey = process.env.GEMINI_API_KEY;
const parseKey = process.env.PARSE_API_KEY;

if (!supabaseUrl || !supabaseKey || !geminiKey) {
    console.error('Missing required credentials (SUPABASE or GEMINI).');
    console.log('Gemini Key Present:', !!geminiKey);
    process.exit(1);
}

console.log(`PARSE_API_KEY Present: ${!!parseKey}`);

const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenerativeAI(geminiKey);
const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

async function generateEmbedding(text) {
    try {
        const result = await embedModel.embedContent(text.substring(0, 8000)); // Limit text
        return result.embedding.values;
    } catch (e) {
        console.error('Embedding Failed:', e.message);
        return null;
    }
}

async function main() {
    console.log('\n--- FIXING PENDING EMBEDDINGS ---');

    // 1. Find pending items in knowledge_base (Provident/Recent)
    const { data: items, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .is('embedding', null)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('DB Error:', error.message);
        return;
    }

    if (items.length === 0) {
        console.log('No pending items found without embeddings.');
        return;
    }

    console.log(`Found ${items.length} pending items.`);

    for (const item of items) {
        console.log(`Processing: ${item.source_name} (${item.id})`);

        if (!item.content || item.content.length < 10) {
            console.log('Skipping: Content too short or empty.');
            continue;
        }

        const embedding = await generateEmbedding(item.content);
        if (!embedding) continue;

        // 2. Update knowledge_base
        const { error: upErr } = await supabase
            .from('knowledge_base')
            .update({ embedding: embedding })
            .eq('id', item.id);

        if (upErr) {
            console.error('Failed to update KB:', upErr.message);
        } else {
            console.log('Updated KB record.');
        }

        // 3. Upsert to rag_chunks (Dual Write: Target + Demo)
        // We write to 'demo' client_id as well to ensure the MVP WhatsApp bot works immediately.
        const targets = [
            { client: item.metadata?.client_id || 'provident', folder: item.project_id },
            { client: 'demo', folder: 'demo_fallback' }
        ];

        for (const target of targets) {
            const chunkId = `${target.client}:${target.folder}:${item.id}:0`;
            console.log(`Upserting chunk for client=${target.client}...`);

            const { error: chunkErr } = await supabase
                .from('rag_chunks')
                .upsert({
                    chunk_id: chunkId,
                    client_id: target.client,
                    folder_id: target.folder,
                    document_id: item.id,
                    content: item.content,
                    embedding: embedding,
                    metadata: {
                        source_name: item.source_name,
                        type: item.type,
                        original_project_id: item.project_id,
                        note: 'Auto-fixed by Antigravity'
                    }
                });

            if (chunkErr) console.error(`Chunk Error (${target.client}):`, chunkErr.message);
        }
    }
    console.log('--- DONE ---');
}

main();
