/**
 * lib/eshelWhatsApp.ts — Eshel-Specific WhatsApp Engagement
 *
 * Parallel to lib/auroWhatsApp.ts (Provident), but reads ALL config
 * from the tenant row — no hard-coded SIDs, no Provident branding.
 *
 * IMPORTANT:
 *  - This file does NOT import or reference lib/auroWhatsApp.ts.
 *  - lib/auroWhatsApp.ts is NOT modified.
 *  - Only called by Eshel-specific Netlify functions.
 *
 * WhatsApp number: Read from tenant.twilio_whatsapp_number only.
 *   For v1, Eshel uses '+12098994972' (Auro's test number), stored in DB.
 *   When Eshel gets its own WABA number, update the DB row — no code change.
 *
 * Template: Read from tenant.whatsapp_template_sid.
 *   If absent, falls back to freeform text using tenant.short_name.
 *   Provident's SID (HX4dacdc5e392cef936e9b911ebc0ec273) is never referenced here.
 */

import { TwilioWhatsAppClient } from './twilioWhatsAppClient';
import { normalizePhone } from './phoneUtils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal slice of the Tenant row needed for Eshel outreach.
 * Avoids importing the full Tenant type to keep this file self-contained.
 */
export interface EshelTenantConfig {
    id: number;
    short_name: string;
    twilio_account_sid: string;
    twilio_auth_token: string;
    twilio_whatsapp_number?: string | null;     // e.g. '+12098994972' for v1
    whatsapp_template_sid?: string | null;      // Twilio Content SID for Eshel template
    whatsapp_template_name?: string | null;     // Human label, e.g. 'wa_message_opt_in_eshel'
}

export interface EshelEngagementParams {
    phone: string;
    name: string;
    projectName?: string;
    tenant: EshelTenantConfig;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Triggers the Eshel WhatsApp initial outreach for a new lead.
 *
 * Returns true on success, false on any failure (errors are logged, not thrown,
 * so they never block the calling webhook from returning 200).
 */
export async function triggerEshelLeadEngagement(
    params: EshelEngagementParams
): Promise<boolean> {
    const { tenant } = params;
    const label = `[tenant=${tenant.id}|${tenant.short_name}]`;
    const phone = normalizePhone(params.phone);
    const firstName = params.name.trim().split(' ')[0] || 'there';
    const projectName = params.projectName || 'our latest properties';

    console.log(`${label}[EshelWhatsApp] Triggering engagement for ${params.name} (${phone})`);

    // --- Guard: WhatsApp number must be present in tenant config ---
    if (!tenant.twilio_whatsapp_number) {
        console.error(
            `${label}[EshelWhatsApp] No WhatsApp number configured for tenant ${tenant.id}. ` +
            `Set tenants.twilio_whatsapp_number in Supabase. Skipping outreach.`
        );
        return false;
    }

    // --- Safety: skip if not production ---
    if (process.env.NODE_ENV !== 'production') {
        console.log(`${label}[EshelWhatsApp] SKIP: Not in production. Would have sent to ${phone}.`);
        return true;
    }

    const client = new TwilioWhatsAppClient(
        tenant.twilio_account_sid,
        tenant.twilio_auth_token,
        // TwilioWhatsAppClient uses messagingServiceSid for the 3rd param;
        // Eshel uses the same Messaging Service as Provident (env var) —
        // only the sender number and template SID differ.
        process.env.TWILIO_MESSAGING_SERVICE_SID
    );

    try {
        let result: { success: boolean; sid?: string; error?: string };

        if (tenant.whatsapp_template_sid) {
            // Send approved WhatsApp template (Eshel-branded)
            console.log(
                `${label}[EshelWhatsApp] Sending template ${tenant.whatsapp_template_name || tenant.whatsapp_template_sid} to ${phone}`
            );
            result = await client.sendTemplateMessage(
                phone,
                tenant.whatsapp_template_sid,
                { '1': firstName }  // {{1}} = first name, matching Provident template convention
            );
        } else {
            // Freeform fallback — used when Eshel template is not yet approved
            const body =
                `Hi ${firstName}, this is ${tenant.short_name}. ` +
                `We received your enquiry regarding ${projectName} and would love to assist you. ` +
                `Are you looking for investment or personal use?`;

            console.log(`${label}[EshelWhatsApp] No template SID configured. Sending freeform to ${phone}.`);
            result = await client.sendTextMessage(phone, body);
        }

        if (result.success) {
            console.log(`${label}[EshelWhatsApp] Message sent. Twilio SID: ${result.sid}`);
            return true;
        } else {
            console.error(`${label}[EshelWhatsApp] Twilio rejected message to ${phone}: ${result.error}`);
            return false;
        }
    } catch (err: any) {
        console.error(`${label}[EshelWhatsApp] Exception during outreach for ${phone}:`, err.message);
        return false;
    }
}
