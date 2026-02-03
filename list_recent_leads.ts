import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function listRecentLeads() {
    const { data, error } = await supabase
        .from('leads')
        .select('id, phone, name, email')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error fetching leads:", error);
    } else {
        console.log("Recent leads:", JSON.stringify(data, null, 2));
    }
}

listRecentLeads();
