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

        // Build message exactly as requested
        const finalProject = projectName || "your property inquiry";

        let message = `Your call about ${finalProject} with Provident has been scheduled.\n`;
        message += `Date & time: ${dateStr} at ${timeStr} (Dubai Time).\n`;
        message += `Join the meeting: ${meetingUrl || 'Link in calendar'}`;

        // Add branded residences PDF for Provident
        if (tenant.id === 1 || tenant.name?.toLowerCase().includes('provident')) {
            message += `\n\nIn the meantime, you can explore Provident's Top Branded Residences PDF here: https://drive.google.com/file/d/1gKCSGYCO6ObmPJ0VRfk4b4TvKZl9sLuB/view`;
        }

        const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

        console.log(`[MEETING_CONFIRMATION] Debug Message Data:`, {
            meetingUrl,
            messageBody: message
        });

        console.log(`[MEETING_CONFIRMATION] Twilio Call Config:`, {
            messagingServiceSid,
            to: leadPhone,
            from: tenant.twilio_whatsapp_number || tenant.twilio_phone_number
        });

        // Use the same TwilioWhatsAppClient as the chat handler
        const twilioClient = new TwilioWhatsAppClient(
            tenant.twilio_account_sid,
            tenant.twilio_auth_token,
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
