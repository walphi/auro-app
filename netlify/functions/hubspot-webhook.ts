import { Handler } from '@netlify/functions';
import * as crypto from 'crypto';
import axios from 'axios';
import { supabase } from '../../lib/supabase';
import { normalizePhone } from '../../lib/phoneUtils';
import { TwilioWhatsAppClient } from '../../lib/twilioWhatsAppClient';

/**
 * netlify/functions/hubspot-webhook.ts
 *
 * Receives HubSpot Webhooks API v3 events.
 * Currently subscribed to: contact.creation
 * 
 * Resolves the Auro tenant from hubspot_tokens by portalId,
 * then triggers WhatsApp outreach and logs to HubSpot.
 */

const MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
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
    receivedSignature: string | undefined,
    logPrefix: string,
    debugMode: boolean
): boolean {
    if (!receivedSignature) {
        console.log(`${logPrefix} [SIG_DEBUG] No received signature`);
        return false;
    }

    // HubSpot v3: HMAC-SHA256(requestMethod + requestUrl + requestBody + timestamp)
    // Note: requestUrl should be path + query only (no protocol/host)
    const sourceString = `${requestMethod}${requestUrl}${requestBody}${timestamp}`;
    
    // ALWAYS log components for debugging (temporary)
    console.log(`${logPrefix} [SIG_DEBUG] Components:`, {
        method: requestMethod,
        url: requestUrl,
        bodyPreview: requestBody.substring(0, 200),
        bodyLength: requestBody.length,
        bodyEnd: requestBody.substring(requestBody.length - 50), // Last 50 chars
        timestamp: timestamp,
    });
    console.log(`${logPrefix} [SIG_DEBUG] Source string length: ${sourceString.length}`);
    console.log(`${logPrefix} [SIG_DEBUG] Full source string: ${sourceString}`);
    
    const expected = crypto
        .createHmac('sha256', clientSecret)
        .update(sourceString)
        .digest('base64');

    console.log(`${logPrefix} [SIG_DEBUG] Expected signature: ${expected.substring(0, 20)}...`);
    console.log(`${logPrefix} [SIG_DEBUG] Received signature: ${receivedSignature.substring(0, 20)}...`);
    console.log(`${logPrefix} [SIG_DEBUG] Signatures match: ${expected === receivedSignature}`);
    console.log(`${logPrefix} [SIG_DEBUG] Secret first 5 chars: ${clientSecret.substring(0, 5)}...`);

    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(receivedSignature);

    // timingSafeEqual throws RangeError if buffer lengths differ
    if (expectedBuffer.length !== receivedBuffer.length) {
        console.log(`${logPrefix} [SIG_DEBUG] Buffer length mismatch: expected=${expectedBuffer.length}, received=${receivedBuffer.length}`);
        return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

// ---------------------------------------------------------------------------
// Helper: Call HubSpot API using private app token (Auro CRM Connector)
// ---------------------------------------------------------------------------

interface HubSpotApiOptions {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    params?: Record<string, any>;
    data?: any;
    headers?: Record<string, string>;
}

async function callHubSpotApi(endpoint: string, options: HubSpotApiOptions = {}) {
    const token = process.env.AURO_HUBSPOT_TOKEN || process.env.ESHEL_HUBSPOT_TOKEN;
    if (!token) {
        throw new Error('AURO_HUBSPOT_TOKEN not configured');
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
// Helper: Create HubSpot note and associate with contact
// ---------------------------------------------------------------------------

interface NotePayload {
    contactId: string;
    noteBody: string;
    hsTimestamp?: string;
}

interface NoteContentData {
    name: string;
    phone: string;
    email?: string;
    source: string;
    leadStatus: string;
    budget?: string;
    preferredArea?: string;
    propertyType?: string;
}

/**
 * Creates a note in HubSpot and associates it with the specified contact.
 * Uses the Auro CRM Connector private app token.
 */
async function addNoteToHubSpotContact(
    payload: NotePayload,
    logPrefix: string
): Promise<{ success: boolean; noteId?: string; error?: string }> {
    const { contactId, noteBody, hsTimestamp } = payload;
    
    try {
        console.log(`${logPrefix} [NotePush] Creating note for contact ${contactId}`);
        const noteResp = await callHubSpotApi('/crm/v3/objects/notes', {
            method: 'POST',
            data: {
                properties: {
                    hs_note_body: noteBody,
                    hs_timestamp: hsTimestamp || new Date().toISOString(),
                },
            },
        });
        
        const noteId = noteResp.data.id;
        console.log(`${logPrefix} [NotePush] Created note ${noteId}`);
        
        console.log(`${logPrefix} [NotePush] Associating note ${noteId} to contact ${contactId}`);
        await callHubSpotApi(
            `/crm/v3/objects/notes/${noteId}/associations/contacts/${contactId}/note_to_contact`,
            { method: 'PUT', data: {} }
        );
        
        console.log(`${logPrefix} [NotePush] Successfully pushed note to HubSpot`);
        return { success: true, noteId };
    } catch (error: any) {
        const errorMsg = error.response?.data?.message || error.message;
        const statusCode = error.response?.status;
        console.error(`${logPrefix} [NotePush] Failed: status=${statusCode}, error=${errorMsg}`);
        return { success: false, error: errorMsg };
    }
}

/**
 * Builds formatted note content for HubSpot timeline.
 * Includes lead details and structured fields when available.
 */
function buildHubSpotNoteContent(data: NoteContentData & { tenantName?: string }): string {
    const tenantName = data.tenantName || 'Auro';
    const lines = [
        `Lead Created via ${data.source}`,
        ``,
        `Name: ${data.name}`,
        `Phone: ${data.phone}`,
    ];
    
    if (data.email) lines.push(`Email: ${data.email}`);
    
    lines.push(`Status: ${data.leadStatus}`);
    lines.push(`Source: WhatsApp / HubSpot Integration`);
    lines.push(`Tenant: ${tenantName} (Auro AI)`);
    lines.push(``);
    lines.push(`---`);
    lines.push(`Note: This lead was automatically created via the Auro integration.`);
    lines.push(`Next step: WhatsApp outreach sent. Awaiting lead response.`);
    
    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const handler: Handler = async (event) => {
    // --- Test endpoint ---
    const queryParams = new URLSearchParams(event.rawQuery || '');
    if (queryParams.get('test') === 'true') {
        console.log('[HubSpotWebhook] Test endpoint hit - hubspot-webhook test ok');
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ok: true, message: 'hubspot-webhook test ok' }),
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'method_not_allowed' }) };
    }

    const body = event.body || '';
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

    if (!clientSecret) {
        console.error('[HubSpotWebhook] HUBSPOT_CLIENT_SECRET not set.');
        return { statusCode: 500, body: JSON.stringify({ error: 'server_misconfiguration' }) };
    }

    // --- Signature + replay validation ---
    const timestamp = event.headers['x-hubspot-request-timestamp'] || '';
    const signature = event.headers['x-hubspot-signature-v3'];

    let events: any[];
    try {
        events = JSON.parse(body);
        if (!Array.isArray(events)) events = [events];
    } catch {
        console.error('[HubSpotWebhook] Failed to parse request body as JSON.');
        return { statusCode: 400, body: JSON.stringify({ error: 'invalid_json' }) };
    }

    let eventTimestamp: number | null = null;
    if (timestamp) {
        const headerTs = parseInt(timestamp, 10);
        if (!isNaN(headerTs) && headerTs > 0) eventTimestamp = headerTs;
    }
    if (!eventTimestamp && events.length > 0 && events[0].occurredAt) {
        const bodyTs = parseInt(events[0].occurredAt, 10);
        if (!isNaN(bodyTs) && bodyTs > 0) eventTimestamp = bodyTs;
    }

    if (eventTimestamp) {
        const eventAge = Date.now() - eventTimestamp;
        if (eventAge > MAX_EVENT_AGE_MS) {
            console.warn(`[HubSpotWebhook] Rejected: event too old (${Math.round(eventAge / 1000 / 60 / 60)} hours).`);
            return { statusCode: 400, body: JSON.stringify({ error: 'event_too_old' }) };
        }
    }

    let requestUri = event.rawUrl || '';
    const uriFormats = [requestUri];
    if (requestUri.startsWith('https://')) {
        requestUri = requestUri.substring(8);
        const pathIndex = requestUri.indexOf('/');
        if (pathIndex !== -1) requestUri = requestUri.substring(pathIndex);
        uriFormats.push(requestUri);
    }
    if (!requestUri || requestUri === '/') {
        requestUri = event.path || '/';
        if (event.rawQuery) requestUri += '?' + event.rawQuery;
        uriFormats.push(requestUri);
    }
    uriFormats.push(event.path || '/');

    let isValid = false;
    for (const testUri of uriFormats) {
        if (validateHubSpotSignature(clientSecret, event.httpMethod, testUri, body, timestamp, signature, '[HubSpotWebhook]', false)) {
            isValid = true;
            break;
        }
    }
    if (!isValid) {
        console.error('[HubSpotWebhook] Invalid HubSpot signature.');
        return { statusCode: 401, body: JSON.stringify({ error: 'invalid_signature' }) };
    }

    console.log(`[HubSpotWebhook] Received ${events.length} event(s).`);

    // --- Resolve tenant from portalId ---
    const portalId = events[0]?.portalId;
    let tenantId: number | null = null;
    let tenant: any = null;

    if (portalId) {
        const { data: tokenRow } = await supabase
            .from('hubspot_tokens')
            .select('tenant_id')
            .eq('hubspot_portal_id', portalId)
            .maybeSingle();
        if (tokenRow) tenantId = tokenRow.tenant_id;
    }

    if (tenantId) {
        const { data: t } = await supabase
            .from('tenants')
            .select('id, short_name, name, twilio_account_sid, twilio_auth_token, twilio_whatsapp_number, whatsapp_template_sid, whatsapp_template_name')
            .eq('id', tenantId)
            .single();
        tenant = t;
    }

    if (!tenant) {
        console.warn(`[HubSpotWebhook] No tenant found for portal ${portalId}. Processing events without WhatsApp outreach.`);
    }

    const LOG_PREFIX = `[tenant=${tenant?.id || 'unknown'}|hubspot_webhook]`;

    // --- Process each contact.creation event ---
    for (const evt of events) {
        const { subscriptionType, objectId } = evt;
        if (subscriptionType !== 'contact.creation') continue;

        console.log(`${LOG_PREFIX} Processing contact.creation for objectId=${objectId}`);

        let contact: any;
        try {
            const resp = await callHubSpotApi(`/crm/v3/objects/contacts/${objectId}`, {
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

        // --- WhatsApp outreach ---
        let whatsappSent = false;
        if (tenant) {
            console.log(`${LOG_PREFIX} Sending WhatsApp template to ${name} (${phone})`);
            try {
                const twilioClient = new TwilioWhatsAppClient(
                    tenant.twilio_account_sid,
                    tenant.twilio_auth_token
                );
                if (tenant.whatsapp_template_sid) {
                    const firstName = name.split(' ')[0] || 'there';
                    const result = await twilioClient.sendTemplateMessage(
                        phone,
                        tenant.whatsapp_template_sid,
                        { '1': firstName }
                    );
                    whatsappSent = result.success;
                } else {
                    const body = `Hi ${name.split(' ')[0] || 'there'}, this is ${tenant.name || tenant.short_name}. We received your enquiry and would love to assist you.`;
                    const result = await twilioClient.sendTextMessage(phone, body);
                    whatsappSent = result.success;
                }
                console.log(`${LOG_PREFIX} WhatsApp send result: ${whatsappSent ? 'success' : 'failed'}`);
            } catch (err: any) {
                console.error(`${LOG_PREFIX} WhatsApp send error:`, err.message);
            }
        }

        // --- ENSURE LEAD EXISTS IN SUPABASE ---
        let leadId: string | undefined;
        let existingLead: any;
        
        try {
            const { data: leadData } = await supabase
                .from('leads')
                .select('id, name, email')
                .eq('phone', phone)
                .eq('tenant_id', tenant?.id || 0)
                .maybeSingle();
            
            existingLead = leadData;
            leadId = existingLead?.id;

            if (!leadId && tenant) {
                const { data: newLead, error: createError } = await supabase
                    .from('leads')
                    .insert({
                        phone,
                        name,
                        status: 'New',
                        source: 'HubSpot',
                        tenant_id: tenant.id,
                        email: contact.email || undefined,
                    })
                    .select('id')
                    .single();
                
                if (!createError && newLead) {
                    leadId = newLead.id;
                    console.log(`${LOG_PREFIX} Created new lead ${leadId} for ${phone}`);
                }
            }

            if (leadId && contact.email && existingLead?.email !== contact.email) {
                await supabase.from('leads').update({ email: contact.email }).eq('id', leadId);
            }
        } catch (leadError: any) {
            console.error(`${LOG_PREFIX} Lead error:`, leadError.message);
        }

        // --- PUSH NOTE TO HUBSPOT CONTACT TIMELINE ---
        if (leadId && objectId) {
            const noteContent = buildHubSpotNoteContent({
                name: existingLead?.name || name,
                phone,
                email: contact.email,
                source: 'HubSpot Webhook',
                leadStatus: 'New',
                tenantName: tenant?.name || 'Auro',
            });
            
            const noteResult = await addNoteToHubSpotContact(
                { contactId: String(objectId), noteBody: noteContent },
                LOG_PREFIX
            );
            if (noteResult.success) {
                console.log(`${LOG_PREFIX} Note created in HubSpot: ${noteResult.noteId}`);
            }
        }

        // Fire-and-forget sidecar
        const sidecarKey = process.env.AURO_SIDECAR_KEY;
        if (sidecarKey && tenant) {
            const sidecarUrl = `${process.env.URL || 'https://auroapp.com'}/.netlify/functions/hubspot-crm-sync`;
            axios.post(sidecarUrl,
                {
                    eventType: 'conversation_note',
                    tenantId: tenant.id,
                    phone,
                    name,
                    email: contact.email || undefined,
                    noteText: `WhatsApp outreach sent from Auro.`,
                    hubspotContactId: String(objectId),
                },
                { headers: { 'x-auro-sidecar-key': sidecarKey } }
            ).catch((e) => {
                console.error(`${LOG_PREFIX} Sidecar fetch failed:`, e.message);
            });
        }
    }

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'processed', count: events.length }),
    };
};

