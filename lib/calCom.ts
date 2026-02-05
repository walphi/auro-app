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
 * Create a booking in Cal.com using the v2 API
 * Following Cal.com v2 spec: https://cal.com/docs/api-reference/v2/bookings/create-a-booking
 */
export async function createCalComBooking(details: CalComBookingDetails) {
    const apiKey = process.env.CALCOM_API_KEY;

    if (!apiKey) {
        throw new Error('Missing Cal.com API Key (CALCOM_API_KEY)');
    }

    // Cal.com v2 API endpoint
    const payload = {
        eventTypeId: details.eventTypeId,
        start: details.start,
        attendee: {
            name: details.name,
            email: details.email,
            phoneNumber: details.phoneNumber,
            timeZone: details.timeZone || 'Asia/Dubai',
            language: 'en'
        },
        metadata: {
            source: 'Auro Vapi AI',
            ...details.metadata
        }
    };

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
