import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { createCalComBooking } from "../../lib/calCom";
import { getTenantByVapiId, getTenantById, getDefaultTenant, Tenant } from "../../lib/tenantConfig";

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

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
        // Vapi places structured data in analysis.structuredData or artifact.structuredData
        const analysis = message?.analysis || call?.analysis || {};
        const structuredData = analysis.structuredData || {};

        const meetingScheduled = structuredData.meeting_scheduled === true ||
            structuredData.meeting_scheduled === 'true' ||
            analysis.bookingMade === true;

        if (!meetingScheduled) {
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
        }

        // --- RESOLVE EVENT TYPE ID ---
        // User provided specific ID: 4644939 for Provident
        let eventTypeIdAttr = process.env.CALCOM_EVENT_TYPE_ID_PROVIDENT || "4644939";

        if (tenant.id !== 1) {
            const tenantEnvKey = `CALCOM_EVENT_TYPE_ID_${tenant.short_name?.toUpperCase()}`;
            eventTypeIdAttr = process.env[tenantEnvKey] || eventTypeIdAttr;
        }

        const eventTypeId = parseInt(eventTypeIdAttr);

        // --- PREPARE DATA ---
        const firstName = structuredData.first_name || leadData.name?.split(' ')[0] || 'Client';
        const lastName = structuredData.last_name || leadData.name?.split(' ').slice(1).join(' ') || '';
        const fullName = `${firstName} ${lastName}`.trim();

        const bookingDetails = {
            eventTypeId,
            start: meetingStartIso,
            name: fullName,
            email: structuredData.email || leadData.email,
            phoneNumber: structuredData.phone || phoneNumber || leadData.phone,
            metadata: {
                budget: structuredData.budget || leadData.budget,
                property_type: structuredData.property_type || leadData.property_type,
                preferred_area: structuredData.preferred_area || leadData.location,
                lead_id: leadId,
                tenant_id: tenant.id,
                call_id: call?.id
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
        console.log(`[Vapi Webhook] Creating Cal.com booking for ${fullName} at ${meetingStartIso}`);
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
        await supabase.from('messages').insert({
            lead_id: leadId,
            type: 'System_Note',
            sender: 'System',
            content: `✅ Cal.com Consultation Booked\nTime: ${new Date(meetingStartIso).toLocaleString('en-US', { timeZone: 'Asia/Dubai' })} Dubai Time\nLink: ${calResult.meetingUrl || 'See Cal.com invitation'}`
        });

        console.log(`[Vapi Webhook] Success: Booking ${calResult.bookingId} created for lead ${leadId}`);

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

export { handler };
