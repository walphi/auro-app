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

type SidecarEventType = 'conversation_note' | 'booking_created';

interface SidecarPayload {
    eventType: SidecarEventType;
    tenantId: number;
    phone: string;
    name: string;
    email?: string;
    noteText: string;
    hubspotContactId?: string;          // If already resolved upstream, skip upsert
    qualificationData?: {
        status?: string;
        budget?: string;
        propertyType?: string;
        area?: string;
    };
    // Booking-specific fields (eventType = 'booking_created')
    booking?: {
        meetingUrl?: string;
        bookingId?: string;
        startTime?: string;
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

    // --- Build note body for booking events ---
    let finalNoteText = noteText;
    if (eventType === 'booking_created' && payload.booking) {
        const { meetingUrl, bookingId, startTime } = payload.booking;
        const formattedTime = startTime
            ? new Date(startTime).toLocaleString('en-US', {
                day: 'numeric', month: 'long',
                hour: 'numeric', minute: '2-digit',
                hour12: true, timeZone: 'Asia/Dubai',
            })
            : 'Not set';

        finalNoteText =
            `📅 AURO BOOKING SUMMARY\n\n` +
            `STATUS: Consultation Booked\n` +
            `TIME: ${formattedTime} (Dubai Time)\n` +
            `LINK: ${meetingUrl || 'N/A'}\n` +
            `BOOKING ID: ${bookingId || 'N/A'}\n\n` +
            `--- LEAD DETAILS ---\n` +
            `Name: ${name}\n` +
            `Phone: ${phone}\n` +
            (qualificationData?.budget ? `Budget: ${qualificationData.budget}\n` : '') +
            (qualificationData?.propertyType ? `Property Type: ${qualificationData.propertyType}\n` : '') +
            (qualificationData?.area ? `Preferred Area: ${qualificationData.area}\n` : '') +
            `\nPowered by Auro AI`;
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
