import { Handler } from '@netlify/functions';
import { TwilioWhatsAppClient } from '../../lib/twilioWhatsAppClient';
import { getTenantById } from '../../lib/tenantConfig';

/**
 * Sends a WhatsApp meeting confirmation after a Cal.com booking.
 * Uses the same TwilioWhatsAppClient as the chat handler for consistency.
 */
export const handler: Handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    try {
        const payload = JSON.parse(event.body || '{}');
        const { leadPhone, projectName, meetingStartIso, tenantId, bookingId, meetingUrl } = payload;

        console.log(`[MEETING_CONFIRMATION] Received request: bookingId=${bookingId}, leadPhone=${leadPhone}, meetingUrl=${meetingUrl}`);

        if (!leadPhone || !meetingStartIso || !tenantId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: leadPhone, meetingStartIso, tenantId' })
            };
        }

        // Get tenant configuration
        const tenant = await getTenantById(parseInt(tenantId));
        if (!tenant) {
            console.error(`[MEETING_CONFIRMATION] Tenant ${tenantId} not found`);
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Tenant not found' })
            };
        }

        // Format date/time
        const dateObj = new Date(meetingStartIso);
        const timeStr = dateObj.toLocaleString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Dubai'
        });
        const dateStr = dateObj.toLocaleString('en-US', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: 'Asia/Dubai'
        });

        // 1. Refactored: Tenant-aware branding & message
        const brandName = tenant.id === 1 ? 'Provident Real Estate' : (tenant.name || 'Auro');
        const projectLabel = projectName || (tenant.id === 1 ? 'Apartment' : 'your property inquiry');

        let message = `Your call about ${projectLabel} with ${brandName} has been scheduled.\n` +
            `Date & time: ${dateStr} at ${timeStr} (Dubai Time).\n` +
            `Join the meeting: ${meetingUrl || 'Link in calendar invite'}`;

        if (tenant.id === 1) {
            message += `\n\nIn the meantime, you can explore Provident's Top Branded Residences PDF here: https://drive.google.com/file/d/1gKCSGYCO6ObmPJ0VRfk4b4TvKZl9sLuB/view`;
        }

        // Resolve Twilio credentials from tenant config or defaults
        const accountSid = tenant.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID;
        const authToken = tenant.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN;
        const messagingServiceSid = (process.env.TWILIO_MESSAGING_SERVICE_SID || '').trim();

        console.log(`[MEETING_CONFIRMATION] Twilio Call Config:`, {
            accountSid: accountSid?.substring(0, 10) + '...',
            messagingServiceSid: messagingServiceSid || 'DIRECT_FROM',
            to: leadPhone,
            brandName
        });

        // Use the same TwilioWhatsAppClient as the chat handler
        const twilioClient = new TwilioWhatsAppClient(
            accountSid,
            authToken,
            messagingServiceSid
        );

        const result = await twilioClient.sendTextMessage(leadPhone, message);

        if (result.success) {
            console.log(`[MEETING_CONFIRMATION] ✅ Sent successfully. SID=${result.sid}`);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    sid: result.sid,
                    bookingId
                })
            };
        } else {
            console.error(`[MEETING_CONFIRMATION] ❌ Failed to send: ${result.error}`);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: result.error,
                    bookingId
                })
            };
        }

    } catch (error: any) {
        console.error('[MEETING_CONFIRMATION] Error:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
