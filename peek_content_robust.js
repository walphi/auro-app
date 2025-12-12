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
    const { data: items } = await supabase.from('knowledge_base')
        .select('source_name, content')
        .order('created_at', { ascending: false })
        .limit(1);

    if (items && items.length > 0) {
        console.log(`Source: ${items[0].source_name}`);
        console.log('--- CONTENT PREVIEW ---');
        console.log(items[0].content.substring(0, 1000));
        console.log('--- END ---');
    }
}
main();
