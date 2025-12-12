import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://zvvtdytsigyxvxpognhq.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY not set");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const phoneNumber = "+971507150121";

async function resetLead() {
    console.log(`Resetting lead for ${phoneNumber}...`);

    const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('phone', phoneNumber)
        .single();

    if (!lead) {
        console.log("✅ No lead found - already clean!");
        return;
    }

    console.log(`Found lead ID: ${lead.id}`);

    // Delete messages first
    const { error: msgError } = await supabase
        .from('messages')
        .delete()
        .eq('lead_id', lead.id);

    if (msgError) console.log("Note: No messages to delete or error:", msgError.message);

    // Delete lead
    const { error: leadError } = await supabase
        .from('leads')
        .delete()
        .eq('id', lead.id);

    if (leadError) {
        console.error("❌ Error deleting lead:", leadError.message);
    } else {
        console.log("✅ Lead successfully reset!");
    }
}

resetLead();
