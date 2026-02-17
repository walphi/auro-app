import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
    const supabase = createClient(
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const { data: messages } = await supabase
        .from('messages')
        .select('sender, content, created_at')
        .eq('lead_id', 'e6302188-f6b7-4cab-9c59-f28bc71e431c')
        .order('created_at', { ascending: false })
        .limit(10);

    console.log(JSON.stringify(messages, null, 2));
}
main();
