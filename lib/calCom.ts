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
 * Specifically optimized for UAE numbers and spoken/formatted inputs.
 *
 * Valid UAE mobile: +971 5X XXXX XXX  →  +971XXXXXXXXX  (12 digits total)
 * Valid UAE landline: +971 [2-9] XXX XXXX  →  +971XXXXXXXX (11-12 digits)
 */
function normalizePhone(raw: string): string | null {
    if (!raw) return null;

    console.log(`[Cal.com] normalizePhone input: "${raw}"`);

    // Remove 'whatsapp:' prefix if present
    let cleaned = raw.replace(/^whatsapp:/i, '').trim();

    // Strip all non-digit characters except leading +
    let hasPlus = cleaned.startsWith('+');
    let digits = cleaned.replace(/\D/g, '');

    // Handle leading 00 (international prefix)
    if (digits.startsWith('00')) {
        digits = digits.slice(2);
    }

    // If we have a + and digits don't start with country code, or no + at all
    // Assume UAE if number doesn't start with a country code
    if (!digits.startsWith('971') && !digits.startsWith('1') && !digits.startsWith('44') && !digits.startsWith('91')) {
        // Remove leading 0 if present (local format)
        if (digits.startsWith('0')) {
            digits = digits.slice(1);
        }
        // Prepend UAE country code
        digits = '971' + digits;
    }

    // Ensure we have at least 10 digits
    if (digits.length < 10) {
        console.warn(`[Cal.com] Phone number too short after normalization: "${digits}" (from raw="${raw}")`);
        return null;
    }

    // UAE-specific: cap at 12 digits (971 + 9 digits). If longer, trim to 12.
    // This handles cases where an extra digit is spoken/transcribed by Vapi.
    if (digits.startsWith('971') && digits.length > 12) {
        console.warn(`[Cal.com] UAE phone has ${digits.length} digits (expected 12), trimming: "${digits}" → "${digits.slice(0, 12)}"`);
        digits = digits.slice(0, 12);
    }

    const result = '+' + digits;
    console.log(`[Cal.com] normalizePhone result: "${result}" (${digits.length} digits)`);
    return result;
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
    console.log(`[MEETING_DEBUG] Cal.com phone normalization: raw="${details.phoneNumber}" → normalized="${normalizedPhone}"`);

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

    // Log the FULL payload as JSON so we can inspect exactly what Cal.com receives
    console.log(`[Cal.com] Full booking payload:`, JSON.stringify(payload, null, 2));

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
