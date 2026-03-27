import { Handler } from '@netlify/functions';
import * as crypto from 'crypto';
import axios from 'axios';
import { supabase } from '../../lib/supabase';
import { triggerEshelLeadEngagement } from '../../lib/eshelWhatsApp';
import { normalizePhone } from '../../lib/phoneUtils';
import { getHubSpotAccessTokenForTenant } from '../../lib/hubspotAuth';

/**
 * netlify/functions/eshel-hubspot-webhook.ts
 *
 * Receives HubSpot Webhooks API v3 events for Eshel Properties (tenant 2).
 * Currently subscribed to: contact.creation
 */

const ESHEL_TENANT_ID = 2;
const MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours - relaxed threshold for webhook processing
const HS_API = 'https://api.hubapi.com';

// ---------------------------------------------------------------------------
// Signature validation
// ---------------------------------------------------------------------------

function validateHubSpotSignature(
    clientSecret: string,
    requestMethod: string,
    requestUrl: string,
    requestBody: string,
    timestamp: string,
    receivedSignature: string | undefined
): boolean {
    if (!receivedSignature) return false;

    // HubSpot v3: HMAC-SHA256(requestMethod + requestUrl + requestBody + timestamp)
    const sourceString = `${requestMethod}${requestUrl}${requestBody}${timestamp}`;
    const expected = crypto
        .createHmac('sha256', clientSecret)
        .update(sourceString)
        .digest('base64');

    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(receivedSignature);

    // timingSafeEqual throws RangeError if buffer lengths differ
    if (expectedBuffer.length !== receivedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

// ---------------------------------------------------------------------------
// Helper: Call HubSpot API as Eshel using private app token
// ---------------------------------------------------------------------------

interface HubSpotApiOptions {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    params?: Record<string, any>;
    data?: any;
    headers?: Record<string, string>;
}

async function callHubSpotAsEshel(endpoint: string, options: HubSpotApiOptions = {}) {
    const token = process.env.ESHEL_HUBSPOT_TOKEN;
    if (!token) {
        throw new Error('ESHEL_HUBSPOT_TOKEN not configured');
    }

    const url = `${HS_API}${endpoint}`;
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
    };

    return axios({
        url,
        method: options.method || 'GET',
        headers,
        data: options.data,
        params: options.params,
    });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const handler: Handler = async (event) => {
    const LOG_PREFIX = `[tenant=2|hubspot_test][EshelWebhook]`;

    // --- Test endpoint ---
    const queryParams = new URLSearchParams(event.rawQuery || '');
    if (queryParams.get('test') === 'true') {
        console.log('[EshelWebhook] Test endpoint hit - eshel-hubspot-webhook test ok');
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ok: true, message: 'eshel-hubspot-webhook test ok' }),
        };
    }

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

    // Parse events early to get occurredAt from body as fallback
    let events: any[];
    try {
        events = JSON.parse(body);
        if (!Array.isArray(events)) events = [events];
    } catch {
        console.error(`${LOG_PREFIX} Failed to parse request body as JSON.`);
        return { statusCode: 400, body: JSON.stringify({ error: 'invalid_json' }) };
    }

    // --- Timestamp validation with detailed logging ---
    // Try header first, then fall back to body's occurredAt
    let eventTimestamp: number | null = null;
    let timestampSource = 'none';

    // Check header timestamp
    if (timestamp) {
        const headerTs = parseInt(timestamp, 10);
        if (!isNaN(headerTs) && headerTs > 0) {
            eventTimestamp = headerTs;
            timestampSource = 'header';
        }
    }

    // Fallback: check first event's occurredAt (HubSpot sends ms since epoch)
    if (!eventTimestamp && events.length > 0 && events[0].occurredAt) {
        const bodyTs = parseInt(events[0].occurredAt, 10);
        if (!isNaN(bodyTs) && bodyTs > 0) {
            eventTimestamp = bodyTs;
            timestampSource = 'body.occurredAt';
        }
    }

    // Log raw values for debugging
    console.log(`${LOG_PREFIX} Timestamp debug:`, {
        headerRaw: timestamp || 'missing',
        bodyOccurredAt: events[0]?.occurredAt || 'missing',
        parsedTimestamp: eventTimestamp,
        source: timestampSource,
        now: Date.now(),
    });

    // Validate timestamp age (allow up to 24 hours = 86400000ms, defined globally as MAX_EVENT_AGE_MS)
    if (eventTimestamp) {
        const eventAge = Date.now() - eventTimestamp;
        console.log(`${LOG_PREFIX} Event age: ${eventAge}ms (${Math.round(eventAge / 1000 / 60)} minutes old)`);
        
        if (eventAge > MAX_EVENT_AGE_MS) {
            console.warn(`${LOG_PREFIX} Rejected: event timestamp too old (${eventAge}ms = ${Math.round(eventAge / 1000 / 60 / 60)} hours).`);
            return { statusCode: 400, body: JSON.stringify({ error: 'event_too_old', age: eventAge }) };
        }
    } else {
        console.warn(`${LOG_PREFIX} No valid timestamp found in header or body. Proceeding anyway.`);
        // Don't reject - just log and continue
    }

    if (!validateHubSpotSignature(clientSecret, event.httpMethod, event.rawUrl, body, timestamp, signature)) {
        console.error(`${LOG_PREFIX} Invalid HubSpot signature.`);
        return { statusCode: 401, body: JSON.stringify({ error: 'invalid_signature' }) };
    }

    console.log(`${LOG_PREFIX} Received ${events.length} event(s).`);

    // --- Logging: Sanitized headers and body preview ---
    const sanitizedHeaders = { ...event.headers };
    delete sanitizedHeaders['x-hubspot-signature-v3'];
    delete sanitizedHeaders['authorization'];
    delete sanitizedHeaders['x-auro-sidecar-key'];
    console.log(`${LOG_PREFIX} Headers:`, JSON.stringify(sanitizedHeaders));
    console.log(`${LOG_PREFIX} Body preview:`, body.substring(0, 500));

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

    // --- Get HubSpot access token using private app token ---
    const privateAppToken = process.env.ESHEL_HUBSPOT_TOKEN;
    if (!privateAppToken) {
        console.error(`${LOG_PREFIX} ESHEL_HUBSPOT_TOKEN not set.`);
        return { statusCode: 500, body: JSON.stringify({ error: 'token_not_configured' }) };
    }
    const accessToken = privateAppToken;

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
            const resp = await callHubSpotAsEshel(`/crm/v3/objects/contacts/${objectId}`, {
                method: 'GET',
                params: { properties: 'phone,email,firstname,lastname' },
            });
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

        // --- LOG TEMPLATE MESSAGE TO SUPABASE ---
        // This ensures the "Yes" reply is recognized as a call confirmation
        if (whatsappSent) {
            try {
                // First, look up the lead by phone
                let { data: existingLead } = await supabase
                    .from('leads')
                    .select('id, name, email')
                    .eq('phone', phone)
                    .eq('tenant_id', ESHEL_TENANT_ID)
                    .maybeSingle();

                let leadId = existingLead?.id;

                // Create lead if doesn't exist
                if (!leadId) {
                    const firstName = name.split(' ')[0] || 'there';
                    const { data: newLead, error: createError } = await supabase
                        .from('leads')
                        .insert({
                            phone: phone,
                            name: name,
                            status: 'New',
                            source: 'HubSpot',
                            tenant_id: ESHEL_TENANT_ID,
                            email: contact.email || undefined
                        })
                        .select('id')
                        .single();
                    
                    if (createError) {
                        console.error(`${LOG_PREFIX} Failed to create lead:`, createError.message);
                    } else if (newLead) {
                        leadId = newLead.id;
                        console.log(`${LOG_PREFIX} Created new lead ${leadId} for ${phone}`);
                    }
                }

                // Update email if lead exists but email is missing or different from HubSpot
                if (leadId && contact.email && existingLead?.email !== contact.email) {
                    await supabase
                        .from('leads')
                        .update({ email: contact.email })
                        .eq('id', leadId);
                    console.log(`${LOG_PREFIX} Updated email for lead ${leadId}: ${contact.email}`);
                }

                // Log the template message as AURO_AI so "Yes" replies work
                if (leadId) {
                    const firstName = (existingLead?.name || name || 'there').split(' ')[0];
                    const templateContent = `Hi ${firstName}, this is Eshel Properties. We received your enquiry, is now a good time to chat?`;
                    
                    await supabase.from('messages').insert({
                        lead_id: leadId,
                        type: 'Message',
                        sender: 'AURO_AI',
                        content: templateContent
                    });
                    
                    console.log(`${LOG_PREFIX} Logged template message to lead ${leadId}`);
                }
            } catch (logError: any) {
                console.error(`${LOG_PREFIX} Failed to log template message:`, logError.message);
                // Non-critical - don't fail the webhook
            }
        }

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

