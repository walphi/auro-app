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
 * 
 * CLI / Local Debugging:
 * ---------------------
 * 1. Run function locally:
 *    netlify dev --function eshel-hubspot-webhook
 *    
 * 2. Test with curl (create test_webhook.json first):
 *    curl -X POST http://localhost:8888/.netlify/functions/eshel-hubspot-webhook \
 *      -H "Content-Type: application/json" \
 *      -H "x-hubspot-signature-v3: <valid-signature>" \
 *      -H "x-hubspot-request-timestamp: 1774624473292" \
 *      -d @test_webhook.json
 *    
 * 3. Watch logs:
 *    netlify functions:logs eshel-hubspot-webhook
 *    
 * 4. Check note creation in HubSpot:
 *    - Go to Eshel's HubSpot portal
 *    - Find the contact by phone/email
 *    - Check Timeline tab for the note
 * 
 * Example test_webhook.json:
 * [{
 *   "eventId": "test-12345",
 *   "subscriptionType": "contact.creation",
 *   "portalId": 147683870,
 *   "occurredAt": 1774624473292,
 *   "objectId": 987654321,
 *   "properties": {
 *     "phone": "+971501234567",
 *     "email": "test@example.com",
 *     "firstname": "Test",
 *     "lastname": "User"
 *   }
 * }]
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
 * Uses the private app token for Eshel tenant.
 */
async function addNoteToHubSpotContact(
    payload: NotePayload,
    logPrefix: string
): Promise<{ success: boolean; noteId?: string; error?: string }> {
    const { contactId, noteBody, hsTimestamp } = payload;
    
    try {
        // Step 1: Create the note object
        console.log(`${logPrefix} [NotePush] Creating note for contact ${contactId}`);
        const noteResp = await callHubSpotAsEshel('/crm/v3/objects/notes', {
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
        
        // Step 2: Associate note with contact
        console.log(`${logPrefix} [NotePush] Associating note ${noteId} to contact ${contactId}`);
        await callHubSpotAsEshel(
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
function buildHubSpotNoteContent(data: NoteContentData): string {
    const lines = [
        `📞 Lead Created via ${data.source}`,
        ``,
        `**Name:** ${data.name}`,
        `**Phone:** ${data.phone}`,
    ];
    
    if (data.email) lines.push(`**Email:** ${data.email}`);
    
    // TODO: Pull these from lead record when available
    // if (data.budget) lines.push(`**Budget:** ${data.budget}`);
    // if (data.preferredArea) lines.push(`**Preferred Area:** ${data.preferredArea}`);
    // if (data.propertyType) lines.push(`**Property Type:** ${data.propertyType}`);
    
    lines.push(`**Status:** ${data.leadStatus}`);
    lines.push(`**Source:** WhatsApp / HubSpot Integration`);
    lines.push(`**Tenant:** Eshel Properties (Auro AI)`);
    lines.push(``);
    lines.push(`---`);
    lines.push(`Note: This lead was automatically created via the Eshel-Auro integration.`);
    lines.push(`Next step: WhatsApp template message sent. Awaiting lead response.`);
    
    return lines.join('\n');
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

    const debugMode = process.env.ESHEL_HUBSPOT_SIGNATURE_DEBUG === 'true';
    
    // Log sanitized headers presence (but never values)
    const sigHeaderPresent = !!event.headers['x-hubspot-signature-v3'];
    const tsHeaderPresent = !!event.headers['x-hubspot-request-timestamp'];
    const secretConfigured = !!clientSecret;
    console.log(`${LOG_PREFIX} Signature check setup:`, {
        sigHeaderPresent,
        tsHeaderPresent,
        secretConfigured,
        clientSecretLength: clientSecret ? clientSecret.length : 0,
    });
    
    // Use rawUrl but strip protocol/host if present
    // HubSpot expects path + query only (e.g., /.netlify/functions/eshel-hubspot-webhook?foo=bar)
    let requestUri = event.rawUrl || '';
    
    console.log(`${LOG_PREFIX} Original rawUrl: ${requestUri}`);
    console.log(`${LOG_PREFIX} event.path: ${event.path}`);
    console.log(`${LOG_PREFIX} event.rawQuery: ${event.rawQuery}`);
    
    // Try multiple URI formats for signature validation
    // HubSpot might use full URL or just path
    const uriFormats = [requestUri];
    
    // Strip protocol and host if present
    if (requestUri.startsWith('https://')) {
        requestUri = requestUri.substring(8); // Remove https://
        const pathIndex = requestUri.indexOf('/');
        if (pathIndex !== -1) {
            requestUri = requestUri.substring(pathIndex);
        }
        uriFormats.push(requestUri);
    } else if (requestUri.startsWith('http://')) {
        requestUri = requestUri.substring(7); // Remove http://
        const pathIndex = requestUri.indexOf('/');
        if (pathIndex !== -1) {
            requestUri = requestUri.substring(pathIndex);
        }
        uriFormats.push(requestUri);
    }
    
    // If rawUrl is empty, reconstruct from path and query
    if (!requestUri || requestUri === '/') {
        requestUri = event.path || '/';
        if (event.rawQuery) {
            requestUri += '?' + event.rawQuery;
        }
        uriFormats.push(requestUri);
    }
    
    // Add path-only version without query string
    const pathOnly = event.path || '/';
    uriFormats.push(pathOnly);
    
    console.log(`${LOG_PREFIX} Request URI formats to try:`, uriFormats);
    
    // Try each URI format until one validates
    let isValid = false;
    let validatedUri = '';
    
    for (const testUri of uriFormats) {
        if (validateHubSpotSignature(clientSecret, event.httpMethod, testUri, body, timestamp, signature, LOG_PREFIX, debugMode)) {
            isValid = true;
            validatedUri = testUri;
            console.log(`${LOG_PREFIX} Signature validated with URI format: ${testUri}`);
            break;
        }
    }
    
    if (!isValid) {
        console.error(`${LOG_PREFIX} Invalid HubSpot signature (tried ${uriFormats.length} URI formats).`);
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

        console.log(`${LOG_PREFIX} WhatsApp send result: ${whatsappSent ? 'success' : 'failed'}`);

        // --- ENSURE LEAD EXISTS IN SUPABASE ---
        // Look up or create lead regardless of WhatsApp success
        let leadId: string | undefined;
        let existingLead: any;
        
        try {
            // Look up existing lead
            const { data: leadData } = await supabase
                .from('leads')
                .select('id, name, email')
                .eq('phone', phone)
                .eq('tenant_id', ESHEL_TENANT_ID)
                .maybeSingle();
            
            existingLead = leadData;
            leadId = existingLead?.id;

            // Create lead if doesn't exist
            if (!leadId) {
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
            } else {
                console.log(`${LOG_PREFIX} Found existing lead ${leadId} for ${phone}`);
            }

            // Update email if different
            if (leadId && contact.email && existingLead?.email !== contact.email) {
                await supabase.from('leads').update({ email: contact.email }).eq('id', leadId);
                console.log(`${LOG_PREFIX} Updated email for lead ${leadId}: ${contact.email}`);
            }
        } catch (leadError: any) {
            console.error(`${LOG_PREFIX} Lead lookup/creation error:`, leadError.message);
        }

        // --- LOG TEMPLATE MESSAGE AND PUSH NOTE TO HUBSPOT ---
        // Only proceed if we have a lead and objectId
        if (leadId && objectId) {
            try {
                // Log template message for WhatsApp nurturing (if WhatsApp was sent)
                if (whatsappSent) {
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

                // --- PUSH NOTE TO HUBSPOT CONTACT TIMELINE ---
                // Always create note in HubSpot when we have lead + contact
                console.log(`${LOG_PREFIX} [NotePush] Preparing note for contact ${objectId}, lead ${leadId}`);
                
                const noteContent = buildHubSpotNoteContent({
                    name: existingLead?.name || name || 'there',
                    phone: phone,
                    email: contact.email,
                    source: 'HubSpot Webhook',
                    leadStatus: 'New',
                });
                
                const noteResult = await addNoteToHubSpotContact(
                    { contactId: String(objectId), noteBody: noteContent },
                    LOG_PREFIX
                );
                
                if (noteResult.success) {
                    console.log(`${LOG_PREFIX} Note created in HubSpot: ${noteResult.noteId}`);
                } else {
                    console.warn(`${LOG_PREFIX} Note creation failed: ${noteResult.error}`);
                }
            } catch (processingError: any) {
                console.error(`${LOG_PREFIX} Error in post-processing:`, processingError.message);
            }
        } else {
            console.warn(`${LOG_PREFIX} Skipping note creation: leadId=${leadId}, objectId=${objectId}`);
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

