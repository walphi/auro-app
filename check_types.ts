import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    const { data: cols } = await supabase.rpc('execute_sql', {
        sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'rag_chunks'"
    });
    console.log(cols);
}

check();
