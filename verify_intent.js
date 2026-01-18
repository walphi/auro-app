
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load from .env.local which has the service role key
dotenv.config({ path: path.resolve('.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials. Ensure .env.local is populated.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Logs a lead intent to the dedicated lead_intents_log table.
 * (Self-contained for the verification script)
 */
async function logLeadIntent(leadId, intentType, payload = {}) {
    try {
        console.log(`[IntentLog] Logging ${intentType} for lead ${leadId}`);
        const { error } = await supabase.from('lead_intents_log').insert({
            lead_id: leadId,
            intent_type: intentType,
            payload: payload
        });
        if (error) {
            console.error(`[IntentLog] Error:`, error.message);
            return false;
        }
        return true;
    } catch (error) {
        console.error(`[IntentLog] Exception:`, error.message);
        return false;
    }
}

async function verifyIntentLogging() {
    console.log('--- Intent Logging Verification ---');
    console.log(`Using URL: ${supabaseUrl}`);

    // 1. Get a test lead ID
    const { data: leads, error: leadError } = await supabase.from('leads').select('id, name').limit(1);

    if (leadError) {
        console.error('❌ Error fetching leads:', leadError.message);
        return;
    }

    if (!leads || leads.length === 0) {
        console.error('No leads found in database. Please create a lead first.');
        return;
    }

    const testLeadId = leads[0].id;
    const testIntentType = 'test_verification';
    const testPayload = {
        message: 'Verifying structured intent logging',
        timestamp: new Date().toISOString(),
        verified: true,
        source: 'verification_script'
    };

    console.log(`Testing with Lead ID: ${testLeadId} (${leads[0].name})`);

    // 2. Log an intent
    const success = await logLeadIntent(testLeadId, testIntentType, testPayload);

    if (success) {
        console.log('✅ logLeadIntent call succeeded.');

        // 3. Verify in database
        const { data: logEntry, error } = await supabase
            .from('lead_intents_log')
            .select('*')
            .eq('lead_id', testLeadId)
            .eq('intent_type', testIntentType)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            console.error('❌ Could not find the logged intent in database:', error.message);
        } else if (logEntry) {
            console.log('✅ Intent confirmed in database!');
            console.log('Log Entry:', JSON.stringify(logEntry, null, 2));
        }
    } else {
        console.error('❌ logLeadIntent call failed.');
    }
}

// Execute
verifyIntentLogging();
