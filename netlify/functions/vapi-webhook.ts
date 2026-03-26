import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import { createCalComBooking } from "../../lib/calCom";
import { getTenantByVapiId, getTenantById, getDefaultTenant, Tenant } from "../../lib/tenantConfig";
import { resolveWhatsAppSender } from "../../lib/twilioWhatsAppClient";

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Sends a WhatsApp notification to the lead about their scheduled call.
 */
async function sendWhatsAppNotification(to: string, projectName: string, startTimeIso: string, tenant: Tenant) {
    const accountSid = tenant.id === 2 
        ? process.env.TWILIO_ACCOUNT_SID_ESHEL_T2 
        : (tenant.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID);
    const authToken = tenant.id === 2 
        ? process.env.TWILIO_AUTH_TOKEN_ESHEL_T2 
        : (tenant.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN);
    const fromOverride = tenant.id === 2 ? process.env.ESHEL_T2_WHATSAPP_FROM : undefined;
    const from = fromOverride || resolveWhatsAppSender(tenant);

    if (!accountSid || !authToken) {
        console.error('[MEETING_WHATSAPP] Missing Twilio credentials');
        return;
    }

    const date = new Date(startTimeIso);
    const timeStr = date.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Dubai'
    });
    const dateStr = date.toLocaleString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'Asia/Dubai'
    });

    // Dynamically set branding
    const brandName = tenant.name || 'Eshel Properties';
    let message = `Your call about ${projectName} with ${brandName} has been scheduled. You’ll be contacted at ${timeStr} on ${dateStr} (Dubai Time) on this number.`;

    if (tenant.id === 1 || tenant.name?.toLowerCase().includes('provident')) {
        message += `\n\nIn the meantime, you can explore Provident’s Top Branded Residences PDF here: https://drive.google.com/file/d/1gKCSGYCO6ObmPJ0VRfk4b4TvKZl9sLuB/view`;
    } else if (tenant.id === 2) {
        message += `\n\nIn the meantime, you can explore Eshel's 2026 UAE Off-Plan Playbook here: https://147683870.fs1.hubspotusercontent-eu1.net/hubfs/147683870/THE_2026_UAE_OFF-PLAN_PLAYBOOK_FINAL_%20(2).pdf`;
    }

    console.log(`[MEETING_WHATSAPP] Booking received from Cal.com: booking_id=N/A lead_phone=${to}`);
    console.log(`[MEETING_WHATSAPP] Sending notification from ${from}`);

    try {
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const params = new URLSearchParams();
        params.append('To', to.startsWith('whatsapp:') ? to : `whatsapp:${to}`);
        params.append('From', from.startsWith('whatsapp:') ? from : `whatsapp:${from}`);
        params.append('Body', message);

        const response = await axios.post(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
            params,
            { headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        console.log(`[MEETING_WHATSAPP] Twilio message SID=${response.data.sid} status=${response.data.status}`);
    } catch (error: any) {
        console.error(`[MEETING_WHATSAPP] Failed to send WhatsApp:`, error.response?.data || error.message);
    }
}

const handler: Handler = async (event) => {
    try {
        if (event.httpMethod !== "POST") {
            return { statusCode: 405, body: "Method Not Allowed" };
        }

        const body = JSON.parse(event.body || "{}");
        // Vapi sends the event in body.message or root body
        const message = body.message;
        const messageType = message?.type || body.type;
        const call = message?.call || body.call;

        console.log(`[Vapi Webhook] Received event: ${messageType} for call: ${call?.id}`);

        // We specifically want end-of-call-report because it contains the final structuredData/analysis
        if (messageType !== "end-of-call-report" && messageType !== "call-ended") {
            return { statusCode: 200, body: JSON.stringify({ message: "Event ignored" }) };
        }

        // --- TENANT RESOLUTION ---
        let tenant: Tenant | null = null;
        const vapiAssistantId = call?.assistantId;
        // The user mentioned tenant_id and lead_id are in variableValues
        const varValues = call?.assistantOverrides?.variableValues || {};
        const tenantIdFromVars = varValues.tenant_id;

        if (tenantIdFromVars) {
            tenant = await getTenantById(parseInt(tenantIdFromVars));
        }
        if (!tenant && vapiAssistantId) {
            tenant = await getTenantByVapiId(vapiAssistantId);
        }
        if (!tenant) {
            tenant = await getDefaultTenant();
        }

        // --- LEAD RESOLUTION ---
        let leadId = varValues.lead_id || call?.extra?.lead_id || call?.metadata?.lead_id;
        let phoneNumber = call?.customer?.number;

        if (phoneNumber) {
            phoneNumber = phoneNumber.replace('whatsapp:', '').trim();
            if (!phoneNumber.startsWith('+')) phoneNumber = '+' + phoneNumber;
        }

        let leadData: any = null;
        if (leadId) {
            const { data } = await supabase.from('leads').select('*').eq('id', leadId).single();
            leadData = data;
        } else if (phoneNumber) {
            const { data } = await supabase.from('leads').select('*').eq('phone', phoneNumber).single();
            leadData = data;
        }

        if (!leadData) {
            console.error(`[Vapi Webhook] Lead not found for phone: ${phoneNumber} or leadId: ${leadId}`);
            return { statusCode: 200, body: JSON.stringify({ error: "Lead not found" }) };
        }
        leadId = leadData.id;

        // --- EXTRACT STRUCTURED DATA ---
        const structuredData = getStructuredData(body);
        const analysis = body.message?.analysis || body.call?.analysis || {};

        const meetingScheduled = structuredData.meeting_scheduled === true ||
            structuredData.meeting_scheduled === 'true' ||
            analysis.bookingMade === true;

        // --- CRM SYNC: Vapi Call Ended Sidecar (Always triggered if Eshel) ---
        if (tenant?.id === 2 && tenant?.crm_type === 'hubspot') {
            const summary = analysis.summary || structuredData.summary || "Conversation completed.";
            const duration = call?.duration || 0;
            // We await here for the "No meeting scheduled" path, or just fire and forget for the booking path
            const syncPromise = triggerHubSpotSidecar(tenant, 'vapi_call_ended', leadData, summary, undefined, {
                vapi: { callId: call?.id, summary, duration }
            });

            if (!meetingScheduled) {
                console.log(`[Vapi Webhook] No meeting scheduled for call: ${call?.id}`);
                await syncPromise; // Ensure it finishes before returning
                return { statusCode: 200, body: JSON.stringify({ message: "No meeting scheduled" }) };
            }
        } else if (!meetingScheduled) {
            console.log(`[Vapi Webhook] No meeting scheduled for call: ${call?.id}`);
            return { statusCode: 200, body: JSON.stringify({ message: "No meeting scheduled" }) };
        }

        const meetingStartIso = structuredData.meeting_start_iso;
        if (!meetingStartIso) {
            console.error(`[Vapi Webhook] Meeting scheduled but meeting_start_iso is missing.`, structuredData);
            return { statusCode: 200, body: JSON.stringify({ error: "Missing meeting_start_iso" }) };
        }

        // --- IDEMPOTENCY CHECK ---
        const { data: existingBooking } = await supabase
            .from('bookings')
            .select('id')
            .eq('lead_id', leadId)
            .eq('tenant_id', tenant.id)
            .eq('meeting_start_iso', meetingStartIso)
            .maybeSingle();

        if (existingBooking) {
            console.log(`[Vapi Webhook] Booking already exists for lead ${leadId} at ${meetingStartIso}`);
            return { statusCode: 200, body: JSON.stringify({ message: "Booking already exists (idempotent)" }) };
        }        // --- RESOLVE EVENT TYPE ID ---
        // User provided specific ID: 4644939 for Provident
        let eventTypeIdAttr = process.env.CALCOM_EVENT_TYPE_ID_PROVIDENT || "4644939";

        if (tenant.id === 2 || tenant.short_name?.toLowerCase() === 'eshel') {
            eventTypeIdAttr = process.env.CALCOM_EVENT_TYPE_ID_ESHEL || process.env.CALCOM_EVENT_TYPE_ID_TENANT_2 || eventTypeIdAttr;
        } else if (tenant.id !== 1) {
            const tenantEnvKey = `CALCOM_EVENT_TYPE_ID_${tenant.short_name?.toUpperCase()}`;
            eventTypeIdAttr = process.env[tenantEnvKey] || eventTypeIdAttr;
        }

        const eventTypeId = parseInt(eventTypeIdAttr);

        // --- PREPARE DATA ---
        const firstName = structuredData.first_name || leadData.name?.split(' ')[0] || 'Client';
        const lastName = structuredData.last_name || leadData.name?.split(' ').slice(1).join(' ') || '';
        const fullName = `${firstName} ${lastName}`.trim();

        let email = structuredData.email || leadData.email;
        if (email) {
            email = normalizeSTTEmail(email);
        }

        // ESHEL Fallback: If no email found for Tenant 2, use a unique phone-based placeholder
        if (!email && (tenant.id === 2 || tenant.short_name?.toLowerCase() === 'eshel')) {
            const fallbackEmail = `${phoneNumber.replace('+', '')}@no-email.auro`;
            console.log(`[Vapi Webhook] Using Eshel fallback email: ${fallbackEmail} (Original STT might have been unusable)`);
            email = fallbackEmail;
            
            // Log fallback usage for monitoring
            await supabase.from('messages').insert({
                lead_id: leadId,
                type: 'System_Note',
                sender: 'System',
                content: `ℹ️ Note: Used fallback email (${fallbackEmail}) for Cal.com booking as no valid email was detected during the call.`
            });
        }

        const bookingDetails = {
            eventTypeId,
            start: meetingStartIso,
            name: fullName,
            email: email,
            phoneNumber: structuredData.phone || phoneNumber || leadData.phone,
            metadata: {
                budget: String(structuredData.budget || leadData.budget || ''),
                property_type: String(structuredData.property_type || leadData.property_type || ''),
                preferred_area: String(structuredData.preferred_area || leadData.location || ''),
                lead_id: String(leadId),
                tenant_id: String(tenant.id),
                call_id: String(call?.id || '')
            }
        };

        if (!bookingDetails.email) {
            console.error(`[Vapi Webhook] Cannot book without email for lead ${leadId}`);
            // Log this so we know why it failed
            await supabase.from('messages').insert({
                lead_id: leadId,
                type: 'System_Note',
                sender: 'System',
                content: `Failed to create Cal.com booking: Missing email address.`
            });
            return { statusCode: 200, body: JSON.stringify({ error: "Missing email" }) };
        }

        // --- CREATE CAL.COM BOOKING ---
        console.log(`[Vapi Webhook] Creating Cal.com booking for ${fullName} at ${meetingStartIso}. Email: ${bookingDetails.email}, EventType: ${eventTypeId}`);
        let calResult;
        try {
            calResult = await createCalComBooking(bookingDetails);
        } catch (calError: any) {
            console.error(`[Vapi Webhook] Cal.com creation failed:`, calError.message);
            return { statusCode: 200, body: JSON.stringify({ error: "Cal.com creation failed" }) };
        }

        // --- CALCULATE END TIME (30 min default) ---
        const startDate = new Date(meetingStartIso);
        const endDate = new Date(startDate.getTime() + 30 * 60000);

        // --- STORE IN DB ---
        const { error: insertError } = await supabase.from('bookings').insert({
            lead_id: leadId,
            tenant_id: tenant.id,
            booking_id: calResult.bookingId,
            booking_provider: 'calcom',
            meeting_start_iso: meetingStartIso,
            meeting_end_iso: endDate.toISOString(),
            status: 'confirmed',
            meta: {
                uid: calResult.uid,
                meeting_url: calResult.meetingUrl,
                call_id: call?.id,
                structured_data: structuredData
            }
        });

        if (insertError) {
            console.error(`[Vapi Webhook] Error inserting booking record:`, insertError);
        }

        // --- UPDATE LEAD ---
        await supabase.from('leads').update({
            booking_status: 'confirmed',
            viewing_datetime: meetingStartIso
        }).eq('id', leadId);

        // --- LOG SUCCESS TO LEAD TIMELINE ---
        const systemNotePrefix = (tenant.id === 2) ? '✅ Eshel Consultation Booked' : '✅ Cal.com Consultation Booked';
        await supabase.from('messages').insert({
            lead_id: leadId,
            type: 'System_Note',
            sender: 'System',
            content: `${systemNotePrefix}\nTime: ${new Date(meetingStartIso).toLocaleString('en-US', { timeZone: 'Asia/Dubai' })} Dubai Time\nLink: ${calResult.meetingUrl || 'See Cal.com invitation'}`
        });

        console.log(`[Vapi Webhook] Success: Booking ${calResult.bookingId} created for lead ${leadId}`);

        // --- SEND WHATSAPP NOTIFICATION ---
        const finalPhone = structuredData.phone || phoneNumber || leadData.phone;
        const finalProject = structuredData.project_name || structuredData.property_interest || "your property inquiry";

        if (finalPhone) {
            // We fire and forget or await depending on whether we want to block the webhook response
            await sendWhatsAppNotification(finalPhone, finalProject, meetingStartIso, tenant);
        }

        // --- CRM SYNC: Booking Created Sidecar ---
        if (tenant?.id === 2 && tenant?.crm_type === 'hubspot' && calResult) {
            await triggerHubSpotSidecar(tenant, 'booking_created', leadData, "Meeting Scheduled", undefined, {
                booking: {
                    meetingUrl: calResult.meetingUrl,
                    bookingId: calResult.bookingId,
                    startTime: meetingStartIso,
                    projectName: finalProject
                }
            });
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Booking successful",
                booking_id: calResult.bookingId,
                meeting_url: calResult.meetingUrl
            })
        };

    } catch (error: any) {
        console.error("[Vapi Webhook Global Error]:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};

/**
 * Extracts correctly structured data from Vapi payload.
 * Supports varied nesting (analysis vs artifact) and casing/naming.
 */
function getStructuredData(body: any): any {
    const message = body.message || body || {};
    const analysis = message.analysis || body.call?.analysis || {};
    const artifact = message.artifact || body.call?.artifact || {};
    const structuredOutputs = artifact.structuredOutputs || {};

    // Vapi sends structuredOutputs as an object keyed by ID or sometimes an array
    const outputsArray = Array.isArray(structuredOutputs) ? structuredOutputs : Object.values(structuredOutputs);

    const harvested: any = {};

    // Map of common variations to our internal keys
    const variations: Record<string, string> = {
        'meetingscheduled': 'meeting_scheduled',
        'meeting_scheduled': 'meeting_scheduled',
        'meetingstartiso': 'meeting_start_iso',
        'meeting_start_iso': 'meeting_start_iso',
        'firstname': 'first_name',
        'first_name': 'first_name',
        'lastname': 'last_name',
        'last_name': 'last_name',
        'email': 'email',
        'phone': 'phone',
        'budget': 'budget',
        'propertytype': 'property_type',
        'property_type': 'property_type',
        'preferredarea': 'preferred_area',
        'preferred_area': 'preferred_area',
        'raw_time_phrase': 'raw_time_phrase',
        'summary': 'summary'
    };

    // 1. Check artifact.structuredOutputs
    outputsArray.forEach((o: any) => {
        const name = o.name?.toLowerCase().replace(/_/g, '');
        const internalKey = variations[name] || o.name;
        if (internalKey) {
            harvested[internalKey] = o.result;
        }
    });

    // 2. Check analysis.structuredData
    const structuredData = analysis.structuredData || {};
    Object.entries(structuredData).forEach(([key, value]) => {
        const internalKey = variations[key.toLowerCase().replace(/_/g, '')] || key;
        if (harvested[internalKey] === undefined) {
            harvested[internalKey] = value;
        }
    });

    // 3. Fallback: Check for specific "Morgan Booking" or similar result objects
    const consolidated = outputsArray.find((o: any) => 
        o.name?.toLowerCase().includes('booking') || o.name?.toLowerCase().includes('consultation')
    );
    if (consolidated?.result) {
        Object.entries(consolidated.result).forEach(([k, v]) => {
            const internalKey = variations[k.toLowerCase().replace(/_/g, '')] || k;
            if (harvested[internalKey] === undefined) {
                harvested[internalKey] = v;
            }
        });
    }

    if (harvested.meeting_start_iso || harvested.meeting_scheduled) {
        console.log(`[VAPI Webhook] Harvested data keys:`, Object.keys(harvested));
    }

    return harvested;
}

/**
 * Normalizes speech-to-text email strings (e.g. "name at domain dot com")
 */
function normalizeSTTEmail(email: string): string {
    if (!email || typeof email !== 'string') return "";
    let normalized = email.toLowerCase().trim();
    // Replace common STT patterns
    normalized = normalized.replace(/\s+at\s+/g, "@");
    normalized = normalized.replace(/\s+dot\s+/g, ".");
    normalized = normalized.replace(/\s+underscore\s+/g, "_");
    normalized = normalized.replace(/\s+/g, ""); // Remove all other spaces
    return normalized;
}

/**
 * Triggers the Eshel CRM sidecar to log info to HubSpot.
 * Only runs if tenant.id === 2 (Eshel) and crm_type is hubspot.
 */
async function triggerHubSpotSidecar(tenant: Tenant, eventType: string, lead: any, noteText: string, hsTimestamp?: string, extra?: any) {
    if (tenant.id !== 2 || tenant.crm_type !== 'hubspot') return;

    const sidecarUrl = `https://${process.env.MEDIA_HOST || 'auro-app.netlify.app'}/.netlify/functions/eshel-hubspot-crm-sync`;
    const sidecarKey = process.env.AURO_SIDECAR_KEY;

    if (!sidecarKey) {
        console.warn("[Sidecar] AURO_SIDECAR_KEY missing. Skipping sync.");
        return;
    }

    try {
        await axios.post(sidecarUrl, {
            eventType,
            tenantId: tenant.id,
            phone: lead.phone,
            name: lead.name,
            email: lead.email,
            noteText,
            hsTimestamp: hsTimestamp || new Date().toISOString(),
            ...extra
        }, {
            headers: { 'x-auro-sidecar-key': sidecarKey }
        });
        console.log(`[Sidecar] Triggered ${eventType} for ${lead.phone}`);
    } catch (err: any) {
        console.error(`[Sidecar] Failed to trigger ${eventType}:`, err.message);
    }
}
