import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";

// Try multiple paths for .env
const envPaths = ['.env', 'auro-rag-mcp/.env'];
for (const p of envPaths) {
    if (fs.existsSync(p)) {
        dotenv.config({ path: p });
    }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const phoneNumber = "+971507150121";

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetLead() {
    console.log(`🚀 Preparing a fresh lead for the demo (${phoneNumber})...`);

    // 1. Find the lead
    const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('phone', phoneNumber)
        .single();

    if (!lead) {
        console.log("✅ No existing lead found - your number is already fresh!");
        return;
    }

    console.log(`📍 Found existing session (ID: ${lead.id}). Cleaning up...`);

    // 2. Delete messages (History)
    const { error: msgError } = await supabase
        .from('messages')
        .delete()
        .eq('lead_id', lead.id);

    if (msgError) console.log("⚠️ Note while deleting messages:", msgError.message);

    // 3. Delete lead (Profile)
    const { error: leadError } = await supabase
        .from('leads')
        .delete()
        .eq('id', lead.id);

    if (leadError) {
        console.error("❌ Error resetting lead:", leadError.message);
    } else {
        console.log("✨ SUCCESS: Your lead profile and message history have been wiped.");
        console.log("📱 You can now send your first message to the WhatsApp bot to start the fresh demo!");
    }
}

resetLead();
