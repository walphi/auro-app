import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    const { data, error } = await supabase.rpc('match_rag_chunks', {
        query_embedding: Array(768).fill(0),
        match_threshold: 0.1,
        match_count: 1,
        filter_tenant_id: 1,
        filter_folder_id: 'campaign_docs'
    });

    if (error) {
        console.error("RPC Error:", error.message);
        if (error.message.includes('too many arguments') || error.message.includes('no function matches')) {
            console.log("FUNCTION SIGNATURE MISMATCH");
        }
    } else {
        console.log("RPC Success, count:", data?.length);
    }
}

check();
