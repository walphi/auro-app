import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Key");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStatus() {
    const phone = '+971507150121';
    console.log(`Checking status for ${phone}...`);

    const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('phone', phone)
        .single();

    if (leadError) {
        console.error("Lead Error:", leadError.message);
    } else {
        console.log("Lead Found:", JSON.stringify(lead, null, 2));

        const { data: messages, error: msgError } = await supabase
            .from('messages')
            .select('*')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: false })
            .limit(10);

        if (msgError) {
            console.error("Messages Error:", msgError.message);
        } else {
            console.log("\nRecent Messages:");
            messages.forEach(m => {
                console.log(`[${m.created_at}] ${m.sender} (${m.type}): ${m.content}`);
            });
        }
    }
}

checkStatus();
