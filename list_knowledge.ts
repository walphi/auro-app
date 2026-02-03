import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function report() {
    const { data: files } = await supabase
        .from('knowledge_base')
        .select('id, source_name, folder_id, created_at')
        .eq('tenant_id', 1)
        .neq('folder_id', 'website')
        .order('folder_id');

    console.log('\n--- PROVIDENT KNOWLEDGE BASE STATUS ---\n');

    const grouped: Record<string, any[]> = {};
    files?.forEach(f => {
        if (!grouped[f.folder_id]) grouped[f.folder_id] = [];
        grouped[f.folder_id].push(f);
    });

    for (const [folder, items] of Object.entries(grouped)) {
        console.log(`[Folder: ${folder.toUpperCase()}]`);
        items.forEach(i => console.log(` - ${i.source_name} (Uploaded: ${new Date(i.created_at).toLocaleDateString()})`));
        console.log('');
    }
}

report();
