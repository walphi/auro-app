import { google } from 'googleapis';

/**
 * Interface for calendar event details
 */
export interface CalendarEventDetails {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    budget?: string;
    propertyType?: string;
    preferredArea?: string;
    startTime: string; // ISO 8601
    durationMinutes?: number;
    calendarId?: string;
}

/**
 * Initialize Google Calendar API with Service Account credentials
 */
function getCalendarClient() {
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!serviceAccountEmail || !privateKey) {
        throw new Error('Missing Google Service Account credentials (GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY)');
    }

    const auth = new google.auth.JWT(
        serviceAccountEmail,
        undefined,
        privateKey,
        ['https://www.googleapis.com/auth/calendar']
    );

    return google.calendar({ version: 'v3', auth });
}

/**
 * Create a consultation event in Google Calendar with a Meet link
 */
export async function createConsultationEvent(details: CalendarEventDetails) {
    const calendar = getCalendarClient();
    const calendarId = details.calendarId || process.env.DEFAULT_CALENDAR_ID || 'c_127da107820e1c9b01e31abba33f79a23b3471a8a364e1c09d1e0f5832c207b3@group.calendar.google.com';

    const startTime = new Date(details.startTime);
    const endTime = new Date(startTime.getTime() + (details.durationMinutes || 30) * 60000);

    const descriptionParts = [
        `Phone/WhatsApp: ${details.phone}`,
        details.budget ? `Budget: ${details.budget}` : null,
        details.propertyType ? `Property Type: ${details.propertyType}` : null,
        details.preferredArea ? `Preferred Area/Project: ${details.preferredArea}` : null,
        '\nScheduled via Morgan (AURO AI Assistant)'
    ].filter(Boolean);

    const event = {
        summary: `Off-Plan Consultation – ${details.firstName} ${details.lastName}`,
        location: 'Google Meet',
        description: descriptionParts.join('\n'),
        start: {
            dateTime: startTime.toISOString(),
            timeZone: 'Asia/Dubai',
        },
        end: {
            dateTime: endTime.toISOString(),
            timeZone: 'Asia/Dubai',
        },
        attendees: [
            { email: details.email }
        ],
        conferenceData: {
            createRequest: {
                requestId: `meet-${Date.now()}-${details.phone.slice(-4)}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' }
            }
        },
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'email', minutes: 24 * 60 },
                { method: 'popup', minutes: 30 },
            ],
        },
    };

    try {
        const response = await calendar.events.insert({
            calendarId,
            requestBody: event,
            conferenceDataVersion: 1,
        });

        console.log(`[Google Calendar] Event created: ${response.data.htmlLink}`);
        return {
            eventId: response.data.id,
            link: response.data.htmlLink,
            meetLink: response.data.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri
        };
    } catch (error: any) {
        console.error('[Google Calendar Error]:', error.response?.data || error.message);
        throw error;
    }
}
