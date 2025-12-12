import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

const rootEnvPath = path.resolve('.env');
if (fs.existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('--- INSPECTING LATEST SOURCE ---');
    // Get the most recent KB item
    const { data: items, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) { console.error(error); return; }

    if (items.length > 0) {
        const item = items[0];
        console.log(`Source: ${item.source_name}`);
        console.log(`Type: ${item.type}`);
        console.log(`URL: ${item.metadata?.source_url}`);
        console.log(`Content Len: ${item.content ? item.content.length : 0}`);

        if (item.content && item.content.length > 500) {
            console.log('✅ Content looks populated!');
            console.log('Preview: ' + item.content.substring(0, 200));
        } else {
            console.log('⚠️ Content is still short/empty.');
        }

        // Check Embedding
        console.log(`Embedding: ${item.embedding ? 'YES (Generated)' : 'NO (Pending)'}`);

        // If pending embedding, warn user (or rely on fix_mvp_data to catch it)
    } else {
        console.log('No recent items found.');
    }
}
main();
