import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

const mcpEnvPath = path.resolve('auro-rag-mcp', '.env');
const rootEnvPath = path.resolve('.env');

if (fs.existsSync(mcpEnvPath)) dotenv.config({ path: mcpEnvPath });
if (fs.existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('--- DELETING EDEN HOUSE SOURCES ---');

    // 1. Find sources
    const { data: sources, error } = await supabase
        .from('knowledge_base')
        .select('id, source_name')
        .ilike('source_name', '%Eden%'); // Matches "Eden House..."

    if (error) { console.error(error); return; }

    if (!sources || sources.length === 0) {
        console.log('No sources found matching "Eden".');
        return;
    }

    console.log(`Found ${sources.length} sources to delete:`);
    sources.forEach(s => console.log(`- ${s.source_name}`));

    // 2. Delete
    const ids = sources.map(s => s.id);
    const { error: delErr } = await supabase
        .from('knowledge_base')
        .delete()
        .in('id', ids);

    if (delErr) {
        console.error('Error deleting:', delErr);
    } else {
        console.log('Successfully deleted sources from knowledge_base.');

        // 3. Clean up rag_chunks
        const { error: chunkErr } = await supabase
            .from('rag_chunks')
            .delete()
            .in('document_id', ids);

        if (chunkErr) console.log('Chunk delete error:', chunkErr.message);
        else console.log('Cleaned up associated chunks from rag_chunks.');
    }
}
main();
