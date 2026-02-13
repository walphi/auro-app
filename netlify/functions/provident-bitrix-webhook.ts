import { Handler } from '@netlify/functions';
import { getLeadById, addLeadComment, updateLead, getDealById, addDealComment, updateDeal } from '../../lib/bitrixClient';
import { triggerLeadEngagement } from '../../lib/auroWhatsApp';
import { normalizePhone } from '../../lib/phoneUtils';

/**
 * Netlify Function: provident-bitrix-webhook
 * 
 * Endpoint for Bitrix24 ONCRMLEADADD event.
 * Validates request, fetches lead details, and triggers engagement.
 */
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const { BITRIX_PROVIDENT_WEBHOOK_URL } = process.env;
const STAGING_LEAD_URL = "https://stage.prestate.link/re";

/**
 * Netlify Function: provident-bitrix-webhook
 * 
 * Endpoint for Bitrix24 events.
 * Handles staging leads (ONCRMLEADADD) and production deals (onCrmDealAdd, onCrmDealUpdate).
 */
export const handler: Handler = async (event, context) => {
    console.log(`[BitrixWebhook] Incoming request: ${event.httpMethod} ${event.path} | Body size: ${event.body?.length || 0} bytes`);

    // 1. Ensure the request is POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: "error",
                message: "Use POST with JSON payload and x-auro-key header"
            }),
        };
    }

    // 2. Read and validate custom header: x-auro-key
    const auroKey = event.headers['x-auro-key'];
    const validKey = process.env.AURO_PROVIDENT_WEBHOOK_KEY;

    if (!auroKey || auroKey !== validKey) {
        console.error(`[Webhook] Unauthorized access attempt. Received key: ${auroKey ? 'present' : 'missing'}`);
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'unauthorized' }),
        };
    }

    try {
        // 3. Parse and validate the body
        if (!event.body) {
            console.error('[Webhook] Empty request body');
            throw new Error('Missing body');
        }

        // Try to parse body. If it's URL encoded (common for Bitrix), we might need to handle it.
        // For now, let's assume JSON as per user request but add robust logging.
        let body: any;
        try {
            body = JSON.parse(event.body);
            console.log('[Webhook] Raw body (JSON):', JSON.stringify(body));
        } catch (e) {
            console.log('[Webhook] Raw body (Text):', event.body);
            // Simple check for URL-encoded body
            if (event.body.includes('=') && !event.body.startsWith('{')) {
                const params = new URLSearchParams(event.body);
                body = {};
                for (const [key, value] of params.entries()) {
                    // Handle nested Bitrix fields like data[FIELDS][ID]
                    if (key.includes('[') && key.includes(']')) {
                        const parts = key.split('[').map(p => p.replace(']', ''));
                        let current = body;
                        for (let i = 0; i < parts.length - 1; i++) {
                            current[parts[i]] = current[parts[i]] || {};
                            current = current[parts[i]];
                        }
                        current[parts[parts.length - 1]] = value;
                    } else {
                        body[key] = value;
                    }
                }
                console.log('[Webhook] Parsed Form Body:', JSON.stringify(body));
            } else {
                throw new Error('Unparsable body');
            }
        }

        let rawEvent = body.event || body.EVENT_NAME || body.event_name;

        // Legacy Support: Default to ONCRMLEADADD if event is missing but data.FIELDS.ID exists
        // This handles older manual tests/postman calls that don't include an explicit event name.
        if (!rawEvent && body.data?.FIELDS?.ID) {
            rawEvent = 'ONCRMLEADADD';
        }

        const normalizedEvent = String(rawEvent || '').toUpperCase();

        // Extract ID - Handle both JSON tree, flat form versions, and custom Auro payloads
        const entityId = body.data?.FIELDS?.ID || body.id || body.data?.id || body.bitrixId || body.bitrix_id;

        if (!entityId || !rawEvent) {
            console.error(`[BitrixWebhook] Invalid payload: Missing entityId (${entityId}) or event (${rawEvent})`);
            console.log(`[BitrixWebhook] Full received body for debugging:`, JSON.stringify(body, null, 2));
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: 'invalid_payload',
                    received: { entityId, event: rawEvent },
                    tip: "Ensure 'event' and either 'bitrixId', 'id', or 'data.FIELDS.ID' are present."
                }),
            };
        }

        // --- PRODUCTION DEAL BRANCH ---
        if (normalizedEvent === "ONCRMDEALADD" || normalizedEvent === "ONCRMDEALUPDATE") {
            console.log(`[BitrixDealWebhook] Processing ${normalizedEvent} for deal ${entityId}`);

            // 1. Fetch deal data from production Bitrix
            let deal;
            try {
                deal = await getDealById(entityId, BITRIX_PROVIDENT_WEBHOOK_URL);
            } catch (error: any) {
                console.error('[BitrixDealWebhook] Error fetching deal:', error.message);
                return { statusCode: 500, body: JSON.stringify({ error: 'bitrix_error' }) };
            }

            // 2. Extract production fields
            const name = deal.UF_CRM_1693544881 || deal.TITLE || 'Recipient';
            const rawPhone = deal.UF_CRM_PHONE_WORK || (deal.PHONE?.[0]?.VALUE);
            const phone = normalizePhone(rawPhone);
            const email = deal.UF_CRM_EMAIL_WORK || (deal.EMAIL?.[0]?.VALUE);

            console.log(`[BitrixClient] Fetched deal ${entityId} with phone ${phone} (raw: ${rawPhone})`);

            if (!phone) {
                console.warn(`[BitrixDealWebhook] Deal ${entityId} has no phone number. Skipping WhatsApp.`);
                return { statusCode: 200, body: JSON.stringify({ status: 'skipped', reason: 'no_phone' }) };
            }

            // 3. Link Deal ID in Supabase for Provident (Tenant 1)
            try {
                const { data: lead, error: findError } = await supabase
                    .from('leads')
                    .select('id, custom_field_1')
                    .eq('phone', phone)
                    .single();

                if (lead) {
                    // Update custom_field_1 with DealID: [id]
                    const currentField = lead.custom_field_1 || '';
                    if (!currentField.includes(`DealID: ${entityId}`)) {
                        const newField = currentField ? `${currentField} | DealID: ${entityId}` : `DealID: ${entityId}`;
                        await supabase.from('leads').update({
                            custom_field_1: newField
                        }).eq('id', lead.id);
                        console.log(`[SupabaseSync] Linked DealID ${entityId} to lead ${lead.id}`);
                    }
                }
            } catch (supabaseError: any) {
                console.error('[SupabaseSync] Error linking deal:', supabaseError.message);
            }

            // 4. Trigger WhatsApp engagement
            const whatsappTriggered = await triggerLeadEngagement({
                phone: phone,
                name: name,
                projectName: deal.TITLE || 'off-plan opportunities'
            });

            // 4. Write back comment to deal in production
            const comment = `AURO - status: WhatsApp engagement triggered for ${phone}`;
            console.log(`[BitrixDeal] Adding comment for deal ${entityId}: ${comment.substring(0, 50)}...`);

            try {
                await addDealComment(entityId, comment, BITRIX_PROVIDENT_WEBHOOK_URL);
            } catch (error: any) {
                console.error(`[BitrixDealWebhook] Failed to add comment to deal ${entityId}:`, error.message);
            }

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'accepted',
                    entityId: entityId,
                    type: 'deal',
                    event: normalizedEvent,
                    whatsappTriggered
                }),
            };
        }

        // --- STAGING LEAD BRANCH ---
        else if (normalizedEvent === "ONCRMLEADADD") {
            console.log(`[Webhook] Processing ONCRMLEADADD for lead ${entityId}`);

            // 1. Fetch full lead data from staging Bitrix
            let bitrixLead;
            try {
                bitrixLead = await getLeadById(entityId, STAGING_LEAD_URL);
            } catch (bitrixError: any) {
                console.error('[Webhook] Bitrix fetch error:', bitrixError.message);
                return {
                    statusCode: 500,
                    body: JSON.stringify({ error: 'bitrix_error', message: 'Failed to fetch lead from CRM' }),
                };
            }

            // 2. Extract lead details
            const rawPhone = bitrixLead.PHONE?.[0]?.VALUE;
            const phone = normalizePhone(rawPhone);
            const name = bitrixLead.NAME || bitrixLead.TITLE || 'Value Home Seekers';
            const projectName = bitrixLead.TITLE || 'off-plan opportunities';
            const responsibleId = bitrixLead.ASSIGNED_BY_ID;

            if (!phone) {
                console.warn(`[Webhook] Lead ${entityId} has no phone number. Skipping WhatsApp engagement.`);
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        status: 'accepted',
                        leadId: entityId,
                        bitrixFetched: true,
                        whatsappTriggered: false,
                        reason: 'missing_phone'
                    }),
                };
            }

            // 3. Trigger WhatsApp engagement flow
            const whatsappTriggered = await triggerLeadEngagement({
                phone: phone,
                name: name,
                projectName: projectName
            });

            // 4. Success response with comment write-back to staging
            try {
                const comment = `AURO - status: Accepted and qualification initiated\nInitial contact triggered via WhatsApp.\nResponsible: ${responsibleId || 'Unknown'}`;
                await addLeadComment(entityId, comment, STAGING_LEAD_URL);

                if (responsibleId) {
                    await updateLead(entityId, {
                        UF_AURO_RESPONSIBLE_ID: responsibleId
                    }, STAGING_LEAD_URL);
                }
            } catch (commentError: any) {
                console.error(`[Webhook] Failed to write back to lead ${entityId}:`, commentError.message);
            }

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'accepted',
                    event: normalizedEvent,
                    leadId: entityId,
                    bitrixFetched: true,
                    whatsappTriggered: whatsappTriggered
                }),
            };
        }

        // --- BOOKING CREATED BRANCH (Auro Internal) ---
        else if (normalizedEvent === "BOOKING_CREATED") {
            const data = body.data || body; // Support both structures
            const bitrixId = data.bitrixId || data.bitrix_id || data.id;
            const leadId = data.lead_id;
            const phone = data.phone;
            const summary = data.summary;
            const transcript = data.transcript;
            const booking = data.booking || {};
            const structured = data.structured || {};

            console.log(`[BitrixBookingWebhook] Processing BOOKING_CREATED for BitrixID ${bitrixId}, Lead ${leadId}`);

            if (!bitrixId) {
                console.warn("[VapiBookingWebhook] No Bitrix ID provided in payload. Skipping update.");
                return {
                    statusCode: 200,
                    body: JSON.stringify({ status: 'ignored', reason: 'no_bitrix_id' })
                };
            }

            // 1. Prepare structured comment
            const formattedDate = booking.start ? new Date(booking.start).toLocaleString('en-US', {
                day: 'numeric',
                month: 'long',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: 'Asia/Dubai'
            }) : 'Not set';

            const comment = `📅 AURO CALL & BOOKING SUMMARY\n\n` +
                `STATUS: Consultation Booked\n` +
                `TIME: ${formattedDate} (Dubai Time)\n` +
                `LINK: ${booking.meetingUrl || 'N/A'}\n` +
                `BOOKING ID: ${booking.bookingId || 'N/A'}\n\n` +
                `--- CALL SUMMARY ---\n` +
                `${summary || 'No summary available.'}\n\n` +
                `--- STRUCTURED DATA ---\n` +
                `- Budget: ${structured.budget || 'N/A'}\n` +
                `- Property Type: ${structured.property_type || 'N/A'}\n` +
                `- Preferred Area: ${structured.preferred_area || 'N/A'}\n` +
                `- Meeting Scheduled: ${structured.meetingscheduled ? 'Yes' : 'No'}\n` +
                `- Meeting Start (ISO): ${structured.meetingstartiso || 'N/A'}\n\n` +
                `--- FULL TRANSCRIPT ---\n` +
                `${transcript?.substring(0, 1000) || 'No transcript.'}${transcript?.length > 1000 ? '...' : ''}\n\n` +
                `Powered by Auro AI`;

            // 2. Try to update Bitrix (as Deal first, as it's the production entity for Provident)
            let result;
            try {
                console.log(`[VapiBookingWebhook] Attempting to update Deal ${bitrixId} and add comment`);

                // Update specific fields if we can identify them (using common internal names or comments)
                const updateFields: any = {
                    COMMENTS: `Auro Note: Cal.com booking made for ${formattedDate}. Budget: ${structured.budget || 'N/A'}`
                };

                // Try to update the deal status/fields
                try {
                    await updateDeal(bitrixId, updateFields, BITRIX_PROVIDENT_WEBHOOK_URL);
                } catch (updErr) {
                    console.warn(`[VapiBookingWebhook] Field update failed, continuing with comment...`);
                }

                result = await addDealComment(bitrixId, comment, BITRIX_PROVIDENT_WEBHOOK_URL);
            } catch (dealErr: any) {
                console.warn(`[VapiBookingWebhook] Deal update failed (${dealErr.message}), trying as Lead...`);
                try {
                    // Similar update for Lead
                    try {
                        await updateLead(bitrixId, {
                            COMMENTS: `Auro Note: Cal.com booking made for ${formattedDate}. Budget: ${structured.budget || 'N/A'}`
                        }, BITRIX_PROVIDENT_WEBHOOK_URL);
                    } catch (e) { }

                    result = await addLeadComment(bitrixId, comment, BITRIX_PROVIDENT_WEBHOOK_URL);
                    console.log(`[VapiBookingWebhook] Successfully added comment to Lead ${bitrixId}`);
                } catch (leadErr: any) {
                    console.error(`[VapiBookingWebhook] Failed to update Bitrix completely: ${leadErr.message}`);
                    return { statusCode: 500, body: JSON.stringify({ error: 'bitrix_update_failed' }) };
                }
            }

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'success',
                    bitrixId: bitrixId,
                    commentAdded: !!result
                }),
            };
        } else {
            console.log(`[Webhook] Unhandled event type: ${normalizedEvent}`);
            return {
                statusCode: 200,
                body: JSON.stringify({ status: 'ignored', event: normalizedEvent }),
            };
        }

    } catch (error: any) {
        console.error('[Webhook] Internal error:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'internal_error' }),
        };
    }
};
