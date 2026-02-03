import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function checkLead() {
    const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('phone', '+447733221144')
        .single();

    if (error) {
        console.error("Error fetching lead:", error);
    } else {
        console.log("Lead data:", JSON.stringify(data, null, 2));
    }
}

checkLead();
