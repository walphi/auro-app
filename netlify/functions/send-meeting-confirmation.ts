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
        const brandName = tenant.id === 1 ? 'Provident Real Estate' : (tenant.name || 'Eshel Properties');
        const projectLabel = projectName || (tenant.id === 1 ? 'Apartment' : 'our latest properties');

        let message = `Your call about ${projectLabel} with ${brandName} has been scheduled.\n` +
            `Date & time: ${dateStr} at ${timeStr} (Dubai Time).\n` +
            `Join the meeting: ${meetingUrl || 'Link in calendar invite'}`;

        if (tenant.id === 1) {
            message += `\n\nIn the meantime, you can explore Provident's Top Branded Residences PDF here: https://drive.google.com/file/d/1gKCSGYCO6ObmPJ0VRfk4b4TvKZl9sLuB/view`;
        } else if (tenant.id === 2) {
            message += `\n\nIn the meantime, you can explore Eshel's 2026 UAE Off-Plan Playbook here: https://147683870.fs1.hubspotusercontent-eu1.net/hubfs/147683870/THE_2026_UAE_OFF-PLAN_PLAYBOOK_FINAL_%20(2).pdf`;
        }

        // 2. Refactored: Resolve correct Twilio credentials by tenant
        const accountSid = tenant.id === 2 
            ? process.env.TWILIO_ACCOUNT_SID_ESHEL_T2 
            : (tenant.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID);
        const authToken = tenant.id === 2 
            ? process.env.TWILIO_AUTH_TOKEN_ESHEL_T2 
            : (tenant.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN);
        const messagingServiceSid = tenant.id === 2 
            ? undefined 
            : (process.env.TWILIO_MESSAGING_SERVICE_SID || '').trim();
        const explicitFrom = tenant.id === 2 
            ? process.env.ESHEL_T2_WHATSAPP_FROM 
            : undefined;

        console.log(`[MEETING_CONFIRMATION] Twilio Call Config:`, {
            accountSid: accountSid?.substring(0, 10) + '...',
            messagingServiceSid: messagingServiceSid || 'DIRECT_FROM',
            explicitFrom: explicitFrom || 'NOT_SET',
            to: leadPhone,
            brandName
        });

        // Use the same TwilioWhatsAppClient as the chat handler
        const twilioClient = new TwilioWhatsAppClient(
            accountSid,
            authToken,
            messagingServiceSid
        );

        // Pass the explicit 'from' number for Eshel/Tenant 2
        const result = await twilioClient.sendTextMessage(leadPhone, message, explicitFrom);

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
