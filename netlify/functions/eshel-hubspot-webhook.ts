import { Handler } from '@netlify/functions';
import * as crypto from 'crypto';
import axios from 'axios';
import { supabase } from '../../lib/supabase';
import { triggerEshelLeadEngagement } from '../../lib/eshelWhatsApp';
import { normalizePhone } from '../../lib/phoneUtils';

/**
 * netlify/functions/eshel-hubspot-webhook.ts
 *
 * Receives HubSpot Webhooks API v3 events for Eshel Properties (tenant 2).
 * Currently subscribed to: contact.creation
 */

const ESHEL_TENANT_ID = 2;
const MAX_EVENT_AGE_MS = 5 * 60 * 1000; // 5 minutes replay protection
const HS_API = 'https://api.hubapi.com';

// ---------------------------------------------------------------------------
// Signature validation
// ---------------------------------------------------------------------------

function validateHubSpotSignature(
    clientSecret: string,
    requestBody: string,
    timestamp: string,
    receivedSignature: string | undefined
): boolean {
    if (!receivedSignature) return false;

    // HubSpot v3: HMAC-SHA256(clientSecret + requestBody + timestamp)
    const payload = `${clientSecret}${requestBody}${timestamp}`;
    const expected = crypto
        .createHmac('sha256', clientSecret)
        .update(payload)
        .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(receivedSignature));
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const handler: Handler = async (event) => {
    const LOG_PREFIX = `[tenant=2|hubspot_test][EshelWebhook]`;

    // --- Kill switch ---
    if (process.env.ESHEL_HUBSPOT_ENABLED !== 'true') {
        console.log(`${LOG_PREFIX} Kill-switch active. Returning 200 no-op.`);
        return { statusCode: 200, body: JSON.stringify({ status: 'disabled' }) };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'method_not_allowed' }) };
    }

    const body = event.body || '';
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

    if (!clientSecret) {
        console.error(`${LOG_PREFIX} HUBSPOT_CLIENT_SECRET not set. Cannot validate signature.`);
        return { statusCode: 500, body: JSON.stringify({ error: 'server_misconfiguration' }) };
    }

    // --- Signature + replay validation ---
    const timestamp = event.headers['x-hubspot-request-timestamp'] || '';
    const signature = event.headers['x-hubspot-signature-v3'];

    const eventAge = Date.now() - parseInt(timestamp || '0', 10);
    if (eventAge > MAX_EVENT_AGE_MS) {
        console.warn(`${LOG_PREFIX} Rejected: event timestamp too old (${eventAge}ms).`);
        return { statusCode: 400, body: JSON.stringify({ error: 'event_too_old' }) };
    }

    if (!validateHubSpotSignature(clientSecret, body, timestamp, signature)) {
        console.error(`${LOG_PREFIX} Signature validation failed.`);
        return { statusCode: 401, body: JSON.stringify({ error: 'invalid_signature' }) };
    }

    // --- Parse events ---
    let events: any[];
    try {
        events = JSON.parse(body);
        if (!Array.isArray(events)) events = [events];
    } catch {
        console.error(`${LOG_PREFIX} Failed to parse request body as JSON.`);
        return { statusCode: 400, body: JSON.stringify({ error: 'invalid_json' }) };
    }

    console.log(`${LOG_PREFIX} Received ${events.length} event(s).`);

    // --- Load Eshel tenant config once ---
    const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .select(`
            id, 
            short_name, 
            twilio_account_sid, 
            twilio_auth_token, 
            twilio_whatsapp_number, 
            whatsapp_template_sid, 
            whatsapp_template_name
        `)
        .eq('id', ESHEL_TENANT_ID)
        .single();

    if (tenantErr || !tenant) {
        console.error(`${LOG_PREFIX} Failed to load tenant config:`, tenantErr?.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'tenant_load_failed' }) };
    }

    // --- Load HubSpot access token for API calls ---
    const { data: tokenRow, error: tokenErr } = await supabase
        .from('hubspot_tokens')
        .select('access_token')
        .eq('tenant_id', ESHEL_TENANT_ID)
        .single();

    if (tokenErr || !tokenRow) {
        console.error(`${LOG_PREFIX} No HubSpot token for tenant 2. Complete OAuth install first.`);
        return { statusCode: 500, body: JSON.stringify({ error: 'no_hubspot_token' }) };
    }

    // --- Process each contact.creation event ---
    for (const evt of events) {
        const { subscriptionType, objectId, portalId } = evt;

        if (subscriptionType !== 'contact.creation') {
            console.log(`${LOG_PREFIX} Skipping event type: ${subscriptionType}`);
            continue;
        }

        console.log(`${LOG_PREFIX} Processing contact.creation for objectId=${objectId} portal=${portalId}`);

        // Fetch full contact details from HubSpot
        let contact: any;
        try {
            const resp = await axios.get(
                `${HS_API}/crm/v3/objects/contacts/${objectId}`,
                {
                    params: { properties: 'phone,email,firstname,lastname' },
                    headers: { Authorization: `Bearer ${tokenRow.access_token}` },
                }
            );
            contact = resp.data.properties;
        } catch (err: any) {
            console.error(`${LOG_PREFIX} Failed to fetch contact ${objectId}:`, err.response?.data || err.message);
            continue;
        }

        const rawPhone = contact.phone;
        if (!rawPhone) {
            console.warn(`${LOG_PREFIX} No phone on contact ${objectId}. Skip.`);
            continue;
        }

        const phone = normalizePhone(rawPhone);
        const name = [contact.firstname, contact.lastname].filter(Boolean).join(' ') || 'there';

        console.log(`${LOG_PREFIX} Triggering WhatsApp for ${name} (${phone}) using template ${tenant.whatsapp_template_name || 'fallback'}`);

        // Trigger WhatsApp engagement
        const whatsappSent = await triggerEshelLeadEngagement({
            phone,
            name,
            tenant: {
                id: tenant.id,
                short_name: tenant.short_name,
                twilio_account_sid: tenant.twilio_account_sid,
                twilio_auth_token: tenant.twilio_auth_token,
                twilio_whatsapp_number: tenant.twilio_whatsapp_number,
                whatsapp_template_sid: tenant.whatsapp_template_sid,
                whatsapp_template_name: tenant.whatsapp_template_name,
            },
        });

        // Fire-and-forget: post initial note to HubSpot via sidecar
        const sidecarKey = process.env.AURO_SIDECAR_KEY;
        const sidecarUrl = `${process.env.URL || 'https://auroapp.com'}/.netlify/functions/eshel-hubspot-crm-sync`;

        if (sidecarKey) {
            const templateLabel = tenant.whatsapp_template_name || tenant.whatsapp_template_sid || 'default';
            const noteText = `WhatsApp outreach sent via template ${templateLabel} from Auro.`;

            // Fire-and-forget
            axios.post(sidecarUrl,
                {
                    eventType: 'conversation_note',
                    tenantId: ESHEL_TENANT_ID,
                    phone,
                    name,
                    email: contact.email || undefined,
                    noteText,
                    hubspotContactId: String(objectId),
                },
                {
                    headers: {
                        'x-auro-sidecar-key': sidecarKey,
                    }
                }
            ).catch((e) => {
                console.error(`${LOG_PREFIX} Sidecar fetch failed (non-critical):`, e.message);
            });
        }
    }

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'processed', count: events.length }),
    };
};

