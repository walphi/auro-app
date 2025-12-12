import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import path from 'path';
import fs from 'fs';

const mcpEnvPath = path.resolve('auro-rag-mcp', '.env');
const rootEnvPath = path.resolve('.env');

if (fs.existsSync(mcpEnvPath)) dotenv.config({ path: mcpEnvPath });
if (fs.existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('--- FORCING EMBED FOR LATEST ITEM ---');

    // 1. Get Latest Item
    const { data: items } = await supabase.from('knowledge_base')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (!items || items.length === 0) { console.log('No item found.'); return; }
    const item = items[0];

    console.log(`Processing: ${item.source_name} (ID: ${item.id})`);
    console.log(`Content Len: ${item.content ? item.content.length : 0}`);

    if (!item.content || item.content.length < 10) {
        console.log('Content too short.');
        return;
    }

    // 2. Generate Embedding
    console.log('Generating embedding...');
    try {
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const res = await model.embedContent(item.content.substring(0, 9000)); // Limit to safe size
        const embedding = res.embedding.values;
        console.log('Embedding generated.');

        // 3. Delete old chunks for this doc (to avoid duplicates)
        await supabase.from('rag_chunks').delete().eq('document_id', item.id);

        // 4. Insert Chunks (Dual Write: Demo + Provident)
        const chunks = [
            {
                document_id: item.id,
                content: item.content, // Assuming simplified 1 chunk for now
                embedding: embedding,
                client_id: 'demo',
                folder_id: 'demo_fallback',
                metadata: item.metadata
            },
            {
                document_id: item.id,
                content: item.content,
                embedding: embedding,
                client_id: 'provident',
                folder_id: 'default_project', // Map user's "Default Project" input
                metadata: item.metadata
            }
        ];

        const { error } = await supabase.from('rag_chunks').insert(chunks);
        if (error) console.log('Insert Error:', error);
        else console.log('Success: Chunk inserted for both clients.');

    } catch (e) {
        console.error('Embedding Error:', e);
    }
}
main();
