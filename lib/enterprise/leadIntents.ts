import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Logs a lead intent to the dedicated lead_intents_log table.
 * 
 * @param leadId - The ID of the lead
 * @param intentType - The type of intent (e.g., 'booking', 'offplan_interest')
 * @param payload - Additional structured context for the intent
 */
export async function logLeadIntent(
    leadId: string,
    intentType: string,
    payload: Record<string, any> = {}
): Promise<boolean> {
    try {
        console.log(`[IntentLog] Logging ${intentType} for lead ${leadId}`);

        const { error } = await supabase.from('lead_intents_log').insert({
            lead_id: leadId,
            intent_type: intentType,
            payload: payload
        });

        if (error) {
            console.error(`[IntentLog] Error logging intent:`, error.message);
            return false;
        }

        return true;
    } catch (error: any) {
        console.error(`[IntentLog] Exception logging intent:`, error.message);
        return false;
    }
}
