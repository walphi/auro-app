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
    console.log('--- CHECKING EDGE CHUNKS ---');
    console.log('Searching for "Edge"...');
    const { data, error } = await supabase
        .from('rag_chunks')
        .select('*')
        .ilike('content', '%Edge%')
        .limit(5);

    if (error) { console.error(error); return; }

    if (data && data.length > 0) {
        console.log(`Found ${data.length} chunks containing "Edge".`);
        data.forEach(c => {
            console.log(`- ID: ${c.chunk_id} | Client: ${c.client_id}`);
            console.log(`  Preview: ${c.content.substring(0, 50)}...`);
        });
    } else {
        console.log('NO CHUNKS found matching "Edge".');
    }
}
main();
