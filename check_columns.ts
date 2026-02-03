import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    // List tables first to be sure
    const { data: tables } = await supabase.from('rag_chunks').select('*').limit(1);
    if (tables && tables.length > 0) {
        console.log("Keys in rag_chunks:", Object.keys(tables[0]));
    } else {
        console.log("No data in rag_chunks to check columns.");
    }
}

check();
