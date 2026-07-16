import { Handler } from '@netlify/functions';
import axios from 'axios';

/**
 * netlify/functions/cal-booking-hubspot.ts
 *
 * Receives Cal.com webhook events (BOOKING_CREATED) for the 30min Auro event type (4644879).
 * When a meeting is booked, looks up the attendee in HubSpot and updates them to
 * Sales Qualified Lead with lead status = CONNECTED (Meeting Booked proxy).
 *
 * Cal.com Webhook Payload (v2):
 * {
 *   triggerEvent: "BOOKING_CREATED",
 *   payload: {
 *     bookingId: number,
 *     eventTypeId: number,
 *     startTime: string (ISO),
 *     endTime: string (ISO),
 *     attendees: [{ name, email, timeZone, phoneNumber }],
 *     metadata: { ... },
 *     meetingUrl: string,
 *     ...
 *   }
 * }
 */

const HS_API = 'https://api.hubapi.com';

// The Auro 30-min booking event type
const AURO_30MIN_EVENT_TYPE_ID = 4644879;

// Lifecycle stage values
const STAGE_SQL = 'salesqualifiedlead';
const STATUS_CONNECTED = 'CONNECTED';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHubSpotToken(): string {
    const token = process.env.AURO_HUBSPOT_TOKEN;
    if (!token) {
        throw new Error('AURO_HUBSPOT_TOKEN not configured');
    }
    return token;
}

async function searchContactByEmail(email: string, token: string): Promise<string | null> {
    try {
        const resp = await axios.post(
            `${HS_API}/crm/v3/objects/contacts/search`,
            {
                filterGroups: [{
                    filters: [{ propertyName: 'email', operator: 'EQ', value: email.toLowerCase().trim() }]
                }],
                properties: ['email', 'firstname', 'lastname', 'lifecyclestage', 'hs_lead_status'],
                limit: 1,
            },
            { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );
        const results = resp.data.results ?? [];
        return results.length > 0 ? results[0] : null;
    } catch (err: any) {
        console.error('[cal-booking-hubspot] searchContactByEmail error:', err.response?.data || err.message);
        return null;
    }
}

async function updateContact(contactId: string, properties: Record<string, string>, token: string): Promise<void> {
    await axios.patch(
        `${HS_API}/crm/v3/objects/contacts/${contactId}`,
        { properties },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
}

async function createContact(properties: Record<string, string>, token: string): Promise<string> {
    const resp = await axios.post(
        `${HS_API}/crm/v3/objects/contacts`,
        { properties },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    return resp.data.id;
}

async function addNote(contactId: string, body: string, token: string): Promise<void> {
    const notePayload = {
        associations: [{
            types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }],
            to: { id: contactId }
        }],
        properties: {
            hs_timestamp: new Date().toISOString(),
            hs_note_body: body,
        }
    };
    await axios.post(
        `${HS_API}/crm/v3/objects/notes`,
        notePayload,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const handler: Handler = async (event) => {
    const logPrefix = '[cal-booking-hubspot]';

    try {
        console.log(`${logPrefix} Received webhook`);

        // Only accept POST
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, body: 'Method Not Allowed' };
        }

        // Parse body
        let body: any;
        try {
            body = JSON.parse(event.body || '{}');
        } catch {
            return { statusCode: 400, body: 'Invalid JSON' };
        }

        const triggerEvent = body.triggerEvent;
        const payload = body.payload || {};

        console.log(`${logPrefix} triggerEvent=${triggerEvent}, eventTypeId=${payload.eventTypeId}`);

        // Only process BOOKING_CREATED for the Auro 30-min event type
        if (triggerEvent !== 'BOOKING_CREATED') {
            console.log(`${logPrefix} Ignoring non-booking event: ${triggerEvent}`);
            return { statusCode: 200, body: 'Ignored - not a booking event' };
        }

        // Accept any event type (not just 4644879) — all bookings are meaningful
        if (payload.eventTypeId && payload.eventTypeId !== AURO_30MIN_EVENT_TYPE_ID) {
            console.log(`${logPrefix} Event type ${payload.eventTypeId} is not the Auro 30-min type. Still processing.`);
        }

        // Extract attendee info
        const attendees = payload.attendees || [];
        if (attendees.length === 0) {
            console.log(`${logPrefix} No attendees in booking payload`);
            return { statusCode: 200, body: 'No attendees' };
        }

        const attendee = attendees[0];
        const email = attendee.email || attendee.emailAddress;
        const name = attendee.name || attendee.firstName + ' ' + (attendee.lastName || '');
        const phone = attendee.phoneNumber || attendee.phone;

        if (!email) {
            console.log(`${logPrefix} No email in attendee data`);
            return { statusCode: 200, body: 'No email' };
        }

        const startTime = payload.startTime || payload.start;
        const endTime = payload.endTime || payload.end;
        const meetingUrl = payload.meetingUrl || payload.location || 'https://cal.com/auro-app/30min';
        const bookingId = payload.bookingId || payload.id || 'unknown';

        console.log(`${logPrefix} Booking: ${bookingId}, Attendee: ${name} <${email}>, Start: ${startTime}`);

        // Get HubSpot token
        const token = getHubSpotToken();

        // Search for existing contact
        const existing = await searchContactByEmail(email, token);

        let contactId: string;
        let isNew = false;

        if (existing) {
            contactId = existing.id;
            console.log(`${logPrefix} Found existing contact: ${contactId} (${existing.properties?.firstname || ''} ${existing.properties?.lastname || ''})`);

            // Update lifecycle stage and lead status
            await updateContact(contactId, {
                lifecyclestage: STAGE_SQL,
                hs_lead_status: STATUS_CONNECTED,
            }, token);

            console.log(`${logPrefix} Updated contact ${contactId} to SQL + CONNECTED`);
        } else {
            // Create new contact
            const nameParts = (name || email.split('@')[0]).split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            contactId = await createContact({
                email: email.toLowerCase().trim(),
                firstname: firstName,
                lastname: lastName,
                phone: phone || '',
                lifecyclestage: STAGE_SQL,
                hs_lead_status: STATUS_CONNECTED,
            }, token);

            isNew = true;
            console.log(`${logPrefix} Created new contact: ${contactId}`);
        }

        // Add a note with meeting details
        const noteBody = [
            `MEETING BOOKED via Cal.com`,
            `Attendee: ${name} <${email}>`,
            `Date/Time: ${startTime || 'N/A'}`,
            `Duration: 30 minutes`,
            `Meeting URL: ${meetingUrl}`,
            `Booking ID: ${bookingId}`,
            `Lifecycle stage: Sales Qualified Lead`,
            `Lead status: Meeting Booked (CONNECTED)`,
            `Source: Cal.com webhook`,
        ].join('\n');

        await addNote(contactId, noteBody, token);
        console.log(`${logPrefix} Note added to contact ${contactId}`);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                contactId,
                isNew,
                stage: STAGE_SQL,
                status: STATUS_CONNECTED,
            }),
        };

    } catch (err: any) {
        console.error(`${logPrefix} Error:`, err.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message }),
        };
    }
};