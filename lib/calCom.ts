import axios from 'axios';

/**
 * Interface for Cal.com booking details
 */
export interface CalComBookingDetails {
    eventTypeId: number;
    start: string; // ISO 8601
    name: string;
    email: string;
    phoneNumber: string;
    metadata?: Record<string, any>;
    timeZone?: string;
}

/**
 * Normalize phone to E.164 format.
 * Must start with + and country code, no spaces or special characters.
 */
function normalizePhone(raw: string): string | null {
    if (!raw) return null;
    // Strip everything except digits and plus
    let cleaned = raw.replace(/[^0-9+]/g, '');
    // If it starts with 00, convert to +
    if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2);
    // If it doesn't start with +, assume UAE and prefix +971
    // (Ensure we don't accidentally double-prefix if '971' is already there without a plus)
    if (!cleaned.startsWith('+')) {
        if (cleaned.startsWith('971')) {
            cleaned = '+' + cleaned;
        } else {
            cleaned = '+971' + cleaned;
        }
    }
    return cleaned;
}

/**
 * Create a booking in Cal.com using the v2 API
 * Following Cal.com v2 spec: https://cal.com/docs/api-reference/v2/bookings/create-a-booking
 */
export async function createCalComBooking(details: CalComBookingDetails) {
    const apiKey = process.env.CALCOM_API_KEY;

    if (!apiKey) {
        throw new Error('Missing Cal.com API Key (CALCOM_API_KEY)');
    }

    const normalizedPhone = normalizePhone(details.phoneNumber);
    console.log('[Cal.com] Normalized phone for attendee:', normalizedPhone);

    // Cal.com v2 API endpoint
    const payload = {
        eventTypeId: details.eventTypeId,
        start: details.start,
        attendee: {
            name: details.name,
            email: details.email,
            phoneNumber: normalizedPhone,
            timeZone: details.timeZone || 'Asia/Dubai',
            language: 'en'
        },
        metadata: {
            source: 'Auro Vapi AI',
            ...details.metadata
        }
    };

    console.log('[Cal.com] REQUEST BODY:', JSON.stringify(payload, null, 2));

    try {
        console.log(`[Cal.com] Creating booking for ${details.email} at ${details.start}...`);

        // POST /v2/bookings
        const response = await axios.post(
            'https://api.cal.com/v2/bookings',
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'cal-api-version': '2024-08-13',
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`[Cal.com] RAW RESPONSE:`, JSON.stringify(response.data, null, 2));

        // Cal.com v2 returns data in data property
        const booking = response.data.data || response.data;
        console.log(`[Cal.com] Booking created successfully: ${booking.id || booking.uid}`);

        return {
            bookingId: (booking.id || booking.uid)?.toString(),
            uid: booking.uid,
            meetingUrl: booking.meetingUrl || booking.videoCallUrl,
            raw: booking
        };
    } catch (error: any) {
        const errorData = error.response?.data;
        console.error('[Cal.com Error]:', JSON.stringify(errorData || error.message, null, 2));
        throw new Error(`Cal.com Booking Failed: ${errorData?.message || error.message}`);
    }
}
