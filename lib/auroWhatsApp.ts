import { TwilioWhatsAppClient } from './twilioWhatsAppClient';
import { normalizePhone } from './phoneUtils';

/**
 * Auro WhatsApp Service
 * 
 * This service triggers automated WhatsApp engagement flows for new leads.
 */

interface EngagementParams {
    phone: string;
    name: string;
    projectName?: string;
}

/**
 * Triggers the automated WhatsApp qualification/engagement flow for a lead
 * @param params Object containing lead phone, name, and optional project name
 */
export async function triggerLeadEngagement(params: EngagementParams): Promise<boolean> {
    const rawPhone = params.phone;
    const phone = normalizePhone(rawPhone);
    const { name, projectName = 'our latest projects' } = params;

    console.log(`[AuroWhatsApp] Triggering engagement flow for ${name} (${phone})`);

    // Safety flag for non-production environments
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[AuroWhatsApp] SKIP: Not in production environment. Would have sent message to ${phone}.`);
        return true;
    }

    const client = new TwilioWhatsAppClient(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN,
        process.env.TWILIO_WHATSAPP_NUMBER
    );

    const message = `Hi ${name}, this is Provident Real Estate. We received your inquiry regarding ${projectName} and would love to assist you. Are you looking for investment or personal use?`;

    const contentSid = process.env.TWILIO_PROVIDENT_CONTENT_SID;

    try {
        let result: { success: boolean; sid?: string; error?: string };

        if (contentSid) {
            // Approved WhatsApp template (twilio/quick-reply).
            // Only {{1}} is used; quick-reply buttons are pre-configured in Twilio.
            const firstName = name.split(' ')[0] || 'there';
            console.log(`[AuroWhatsApp] Sending template ${contentSid} to ${phone}`);
            result = await client.sendTemplateMessage(phone, contentSid, { '1': firstName });
        } else {
            // Fallback: freeform text (used when env var is absent, e.g. dev/staging).
            console.log(`[AuroWhatsApp] Sending freeform message to ${phone} (no ContentSid configured)`);
            result = await client.sendTextMessage(phone, message);
        }

        if (result.success) {
            console.log(`[AuroWhatsApp] Initial engagement message sent to ${phone}. SID: ${result.sid}`);
            return true;
        } else {
            console.error(`[AuroWhatsApp] Failed to send message to ${phone}: ${result.error}`);
            return false;
        }
    } catch (error: any) {
        console.error(`[AuroWhatsApp] Exception triggering engagement for ${phone}:`, error.message);
        return false;
    }
}
