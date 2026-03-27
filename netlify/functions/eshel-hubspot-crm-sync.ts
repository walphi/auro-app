import { Handler } from '@netlify/functions';
import { supabase } from '../../lib/supabase';
import { syncLeadNote } from '../../lib/crmRouter';
import axios from 'axios';

const HS_API = 'https://api.hubapi.com';

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
        budget?: string;
        propertyType?: string;
        area?: string;
    };
    vapi?: {
        callId?: string;
        summary?: string;
        duration?: number;
    };
    whatsappContext?: string;  // WhatsApp conversation summary before the call
}

// ---------------------------------------------------------------------------
// Helper: Sync to HubSpot using Private App Token (for Eshel/tenant 2)
// ---------------------------------------------------------------------------

interface PrivateTokenSyncPayload {
    tenantId: number;
    phone: string;
    name: string;
    email?: string;
    noteText: string;
    hubspotContactId?: string;
    hsTimestamp?: string;
}

async function syncToHubSpotWithPrivateToken(
    payload: PrivateTokenSyncPayload
): Promise<{ contactId: string; created: boolean }> {
    const { phone, name, email, noteText, hubspotContactId, hsTimestamp } = payload;
    const token = process.env.ESHEL_HUBSPOT_TOKEN;
    
    if (!token) {
        throw new Error('ESHEL_HUBSPOT_TOKEN not configured');
    }
    
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
    
    let contactId = hubspotContactId;
    let created = false;
    
    // Step 1: Find or create contact
    if (!contactId) {
        // Search by phone
        const searchResp = await axios.post(
            `${HS_API}/crm/v3/objects/contacts/search`,
            {
                filterGroups: [{
                    filters: [{ propertyName: 'phone', operator: 'EQ', value: phone }]
                }],
                properties: ['id', 'phone', 'email'],
                limit: 1,
            },
            { headers }
        );
        
        const results = searchResp.data.results;
        if (results && results.length > 0) {
            contactId = results[0].id;
            console.log(`[EshelCrmSync] Found existing contact ${contactId} by phone ${phone}`);
        } else {
            // Create new contact
            const nameParts = name.trim().split(' ');
            const createResp = await axios.post(
                `${HS_API}/crm/v3/objects/contacts`,
                {
                    properties: {
                        phone: phone,
                        firstname: nameParts[0] || '',
                        lastname: nameParts.slice(1).join(' ') || '',
                        email: email || '',
                    },
                },
                { headers }
            );
            contactId = createResp.data.id;
            created = true;
            console.log(`[EshelCrmSync] Created new contact ${contactId} for ${phone}`);
        }
    }
    
    if (!contactId) {
        throw new Error('Failed to resolve or create HubSpot contact');
    }
    
    // Step 2: Create note
    const noteResp = await axios.post(
        `${HS_API}/crm/v3/objects/notes`,
        {
            properties: {
                hs_note_body: noteText,
                hs_timestamp: hsTimestamp || new Date().toISOString(),
            },
        },
        { headers }
    );
    
    const noteId = noteResp.data.id;
    console.log(`[EshelCrmSync] Created note ${noteId}`);
    
    // Step 3: Associate note with contact
    await axios.put(
        `${HS_API}/crm/v3/objects/notes/${noteId}/associations/contacts/${contactId}/note_to_contact`,
        {},
        { headers }
    );
    
    console.log(`[EshelCrmSync] Associated note ${noteId} with contact ${contactId}`);
    
    return { contactId, created };
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
    const body = JSON.parse(event.body || "{}");
    console.log(`[EshelCrmSync] Received ${body.eventType} for tenant ${body.tenantId}. Phone: ${body.phone}`);
    const payload: SidecarPayload = body;

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

    // --- Build final note body and check priority (Eshel T2 only) ---
    // User requested to prioritize certain System_Note content for CRM sync.
    let finalNoteText = noteText;
    const priorityPatterns = [
        "Cal.com Consultation Booked",
        "Booking successful",
        "Eshel Consultation Booked",
        "WhatsApp outreach sent",
        "AI Call Ended"
    ];

    if (tenantId === 2 && (eventType as string) === 'conversation_note') {
        const isPriority = priorityPatterns.some(p => noteText.includes(p));
        if (!isPriority) {
            console.log(`${label}[EshelCrmSync] Skipping non-priority conversation note: "${noteText.substring(0, 40)}..."`);
            return { statusCode: 200, body: JSON.stringify({ status: 'skipped', reason: 'non_priority' }) };
        }
    }

    if (eventType === 'whatsapp_inbound') {
        finalNoteText = `[WhatsApp Inbound] Lead: ${noteText}`;
        console.log(`${label}[EshelCrmSync] Formatting WhatsApp inbound note for ${phone}`);
    } else if (eventType === 'whatsapp_outbound') {
        finalNoteText = `[WhatsApp Outbound] Auro: ${noteText}`;
        console.log(`${label}[EshelCrmSync] Formatting WhatsApp outbound note for ${phone}`);
    } else if (eventType === 'vapi_call_ended') {
        const summary = payload.vapi?.summary || 'No summary available';
        const duration = payload.vapi?.duration ? `${Math.floor(payload.vapi.duration)}s` : 'N/A';
        const callId = payload.vapi?.callId || 'N/A';
        
        console.log(`${label}[EshelCrmSync] Formatting Vapi call ended note for ${phone}`, {
            hasContext: !!payload.whatsappContext,
            hasQualification: !!qualificationData,
            summaryLength: summary.length,
        });
        
        // Build enhanced note with WhatsApp context and qualification data
        let noteParts = [`📞 AI Call Ended`];
        
        // Add WhatsApp conversation context if available
        if (payload.whatsappContext) {
            noteParts.push(`\n📱 WhatsApp Conversation (before call):\n${payload.whatsappContext}`);
        }
        
        // Add voice call summary
        noteParts.push(`\n🎙️ Voice Call Summary: ${summary}`);
        
        // Add qualification details if available
        if (qualificationData) {
            noteParts.push(`\n📋 Qualification Details:`);
            if (qualificationData.budget) noteParts.push(`• Budget: ${qualificationData.budget}`);
            if (qualificationData.propertyType) noteParts.push(`• Property Type: ${qualificationData.propertyType}`);
            if (qualificationData.area) noteParts.push(`• Preferred Area: ${qualificationData.area}`);
            if (qualificationData.status) noteParts.push(`• Status: ${qualificationData.status}`);
        }
        
        // Add call metadata
        noteParts.push(`\n⏱️ Duration: ${duration}\n🆔 Call ID: ${callId}`);
        
        finalNoteText = noteParts.join('');
    } else if (eventType === 'booking_created' && payload.booking) {
        const { meetingUrl, startTime, projectName } = payload.booking;
        const formattedTime = startTime
            ? new Date(startTime).toLocaleString('en-US', {
                weekday: 'long', day: 'numeric', month: 'long',
                hour: 'numeric', minute: '2-digit',
                hour12: true, timeZone: 'Asia/Dubai',
            })
            : 'Not set';

        const projectLabel = payload.booking?.projectName || 'our latest properties';
        const budget = qualificationData?.budget || payload.booking?.budget || 'Not specified';
        const propType = qualificationData?.propertyType || payload.booking?.propertyType || 'Not specified';
        const area = qualificationData?.area || payload.booking?.area || projectLabel;

        console.log(`${label}[EshelCrmSync] Formatting booking note for ${phone}`, {
            meetingTime: formattedTime,
            project: projectLabel,
        });

        finalNoteText =
            `Eshel Consultation Booked – 30 min call on ${formattedTime} (Dubai Time) ` +
            `about ${budget}, ${propType}, ${area}.\n\n` +
            `Join the meeting: ${meetingUrl || 'N/A'}\n\n` +
            `📚 Explore Eshel's 2026 UAE Off-Plan Playbook: https://bit.ly/eshel-prop-uae-playbook\n` +
            `🏠 Explore Eshel's property portfolio: https://www.eshelproperties.com/property-listings`;
    }

    // --- Sync to HubSpot ---
    // For tenant 2 (Eshel), use private app token directly instead of OAuth flow
    try {
        let result;
        
        if (tenantId === 2) {
            // Eshel: Use private app token for direct API calls
            console.log(`${label}[EshelCrmSync] Using private app token for Eshel (tenant 2)`);
            result = await syncToHubSpotWithPrivateToken({
                tenantId,
                phone,
                name,
                email,
                noteText: finalNoteText,
                hubspotContactId: payload.hubspotContactId,
                hsTimestamp: payload.hsTimestamp,
            });
        } else {
            // Other tenants: Use OAuth flow via crmRouter
            result = await syncLeadNote(tenant.crm_type, {
                tenantId,
                phone,
                name,
                email,
                noteText: finalNoteText,
                qualificationData,
                hsTimestamp: payload.hsTimestamp,
            });
        }

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
