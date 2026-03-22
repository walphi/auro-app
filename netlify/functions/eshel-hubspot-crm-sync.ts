import { Handler } from '@netlify/functions';
import { supabase } from '../../lib/supabase';
import { syncLeadNote } from '../../lib/crmRouter';

/**
 * netlify/functions/eshel-hubspot-crm-sync.ts
 *
 * Fire-and-forget sidecar that writes notes (and optionally contact property
 * updates) to HubSpot for Eshel leads. Called asynchronously by:
 *   - eshel-hubspot-webhook (on new lead)
 *
 * Future trigger points (when expanded):
 *   - Booking confirmation events (booking note)
 *
 * Authentication: x-auro-sidecar-key header must match AURO_SIDECAR_KEY env var.
 *
 * Error handling: All errors are caught and logged. This function always
 * returns 200 to prevent retry loops. Failures here NEVER impact the
 * primary WhatsApp or Vapi flows.
 *
 * Protected files NOT touched: whatsapp.ts, vapi.ts, bitrixClient.ts, auroWhatsApp.ts
 */

// ---------------------------------------------------------------------------
// Payload types
// ---------------------------------------------------------------------------

type SidecarEventType =
    | 'conversation_note'
    | 'booking_created'
    | 'whatsapp_inbound'
    | 'whatsapp_outbound'
    | 'vapi_call_ended';

interface SidecarPayload {
    eventType: SidecarEventType;
    tenantId: number;
    phone: string;
    name: string;
    email?: string;
    noteText: string;
    hsTimestamp?: string;
    hubspotContactId?: string;          // If already resolved upstream, skip upsert
    qualificationData?: {
        status?: string;
        budget?: string;
        propertyType?: string;
        area?: string;
    };
    // Booking / Vapi-specific fields
    booking?: {
        meetingUrl?: string;
        bookingId?: string;
        startTime?: string;
        projectName?: string;
    };
    vapi?: {
        callId?: string;
        summary?: string;
        duration?: number;
    };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const handler: Handler = async (event) => {
    // --- Auth ---
    const receivedKey = event.headers['x-auro-sidecar-key'];
    const expectedKey = process.env.AURO_SIDECAR_KEY;

    if (!expectedKey || receivedKey !== expectedKey) {
        console.warn('[EshelCrmSync] Unauthorized request — invalid or missing x-auro-sidecar-key');
        return { statusCode: 401, body: JSON.stringify({ error: 'unauthorized' }) };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'method_not_allowed' }) };
    }

    // --- Parse body ---
    let payload: SidecarPayload;
    try {
        payload = JSON.parse(event.body || '{}');
    } catch {
        console.error('[EshelCrmSync] Could not parse request body as JSON');
        return { statusCode: 200, body: JSON.stringify({ status: 'error', reason: 'invalid_json' }) };
    }

    const { tenantId, phone, name, email, noteText, eventType, hubspotContactId, qualificationData } = payload;

    console.log(`[tenant=${tenantId}|eshel][EshelCrmSync] Processing ${eventType || 'unknown'} event for ${name} (${phone})`);

    // --- Validate tenant is a HubSpot tenant ---
    const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .select('id, crm_type, hubspot_label')
        .eq('id', tenantId)
        .single();

    if (tenantErr || !tenant) {
        console.error(`[EshelCrmSync] Tenant ${tenantId} not found:`, tenantErr?.message);
        return { statusCode: 200, body: JSON.stringify({ status: 'error', reason: 'tenant_not_found' }) };
    }

    if (tenant.crm_type !== 'hubspot') {
        console.warn(`[EshelCrmSync] Tenant ${tenantId} crm_type is '${tenant.crm_type}', not 'hubspot'. Skipping.`);
        return { statusCode: 200, body: JSON.stringify({ status: 'skipped', reason: 'not_hubspot_tenant' }) };
    }

    const label = `[tenant=${tenantId}|${tenant.hubspot_label || 'eshel'}]`;

    // --- Build final note body ---
    let finalNoteText = noteText;

    if (eventType === 'whatsapp_inbound') {
        finalNoteText = `[WhatsApp Inbound] Lead: ${noteText}`;
    } else if (eventType === 'whatsapp_outbound') {
        finalNoteText = `[WhatsApp Outbound] Auro: ${noteText}`;
    } else if (eventType === 'vapi_call_ended') {
        const summary = payload.vapi?.summary || 'No summary available';
        const duration = payload.vapi?.duration ? `${Math.floor(payload.vapi.duration)}s` : 'N/A';
        finalNoteText = `📞 AI Call Ended\n\nSummary: ${summary}\nDuration: ${duration}\nCall ID: ${payload.vapi?.callId || 'N/A'}`;
    } else if (eventType === 'booking_created' && payload.booking) {
        const { meetingUrl, startTime, projectName } = payload.booking;
        const formattedTime = startTime
            ? new Date(startTime).toLocaleString('en-US', {
                weekday: 'long', day: 'numeric', month: 'long',
                hour: 'numeric', minute: '2-digit',
                hour12: true, timeZone: 'Asia/Dubai',
            })
            : 'Not set';

        const projectLabel = projectName || 'our latest properties';

        // Provident-style formatting for Eshel
        finalNoteText =
            `Your call about ${projectLabel} with Eshel Properties has been scheduled.\n` +
            `Date & time: ${formattedTime} (Dubai Time).\n` +
            `Join the meeting: ${meetingUrl || 'N/A'}\n\n` +
            `In the meantime, you can explore Eshel's property portfolio here:\n` +
            `https://auroapp.com/eshel-properties`;
    }

    // --- Sync to HubSpot ---
    try {
        const result = await syncLeadNote(tenant.crm_type, {
            tenantId,
            phone,
            name,
            email,
            noteText: finalNoteText,
            qualificationData,
            hsTimestamp: payload.hsTimestamp,
        });

        console.log(
            `${label}[EshelCrmSync] ${eventType} synced. ` +
            `Contact: ${result.contactId} (${result.created ? 'created' : 'updated'})`
        );

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'ok',
                eventType,
                contactId: result.contactId,
                created: result.created,
            }),
        };
    } catch (err: any) {
        // Errors are logged but never surface as HTTP errors — sidecar failures
        // must not cause retry storms or impact the primary flow.
        console.error(`${label}[EshelCrmSync] syncLeadNote failed for ${phone}:`, err.message);
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'error', reason: err.message }),
        };
    }
};
