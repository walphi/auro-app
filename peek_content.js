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
    const { data: items } = await supabase.from('knowledge_base')
        .select('content')
        .order('created_at', { ascending: false })
        .limit(1);

    if (items && items.length > 0) {
        console.log('--- DB CONTENT PREVIEW ---');
        console.log(items[0].content.substring(0, 3000));
        console.log('--- END ---');
    } else {
        console.log('No items found.');
    }
}
main();
