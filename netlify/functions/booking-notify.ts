import { Handler } from '@netlify/functions';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// Email provider: Resend (or fallback to log-only for demo)
const RESEND_API_KEY = process.env.RESEND_API_KEY;

interface BookingNotification {
    lead_id: string;
    lead_email?: string;
    lead_phone?: string;
    lead_name?: string;
    property_title: string;
    property_id: string;
    viewing_datetime: string;
    formatted_date: string;
}

async function sendEmailNotification(booking: BookingNotification): Promise<boolean> {
    if (!RESEND_API_KEY) {
        console.log('[Notify] Email skipped - RESEND_API_KEY not configured');
        return false;
    }

    if (!booking.lead_email) {
        console.log('[Notify] Email skipped - no email address for lead');
        return false;
    }

    try {
        const emailHtml = `
            <h2>✅ Viewing Confirmed!</h2>
            <p>Dear ${booking.lead_name || 'Valued Client'},</p>
            <p>Your property viewing has been confirmed:</p>
            <table style="margin: 20px 0; border-collapse: collapse;">
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Property</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${booking.property_title}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Date & Time</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${booking.formatted_date}</td></tr>
            </table>
            <p>Our agent will meet you at the property location.</p>
            <p>If you need to reschedule, simply reply to this email or message us on WhatsApp.</p>
            <br>
            <p>Best regards,<br>Provident Real Estate</p>
        `;

        const response = await axios.post('https://api.resend.com/emails', {
            from: 'Provident Real Estate <bookings@auro-app.com>',
            to: [booking.lead_email],
            subject: `Viewing Confirmed: ${booking.property_title}`,
            html: emailHtml
        }, {
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('[Notify] Email sent successfully:', response.data);
        return true;
    } catch (error: any) {
        console.error('[Notify] Email failed:', error.response?.data || error.message);
        return false;
    }
}

async function sendWhatsAppNotification(booking: BookingNotification): Promise<boolean> {
    if (!booking.lead_phone) {
        console.log('[Notify] WhatsApp skipped - no phone number');
        return false;
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER || 'whatsapp:+14155238886';

    if (!accountSid || !authToken) {
        console.log('[Notify] WhatsApp skipped - Twilio not configured');
        return false;
    }

    try {
        const messageText = `✅ *Viewing Confirmed!*\n\n📍 *Property:* ${booking.property_title}\n📅 *Date:* ${booking.formatted_date}\n\nOur agent will meet you at the property. Reply here if you need to reschedule.`;

        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const params = new URLSearchParams();
        params.append('To', booking.lead_phone.startsWith('whatsapp:') ? booking.lead_phone : `whatsapp:${booking.lead_phone}`);
        params.append('From', from.startsWith('whatsapp:') ? from : `whatsapp:${from}`);
        params.append('Body', messageText);

        const response = await axios.post(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
            params,
            { headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        console.log('[Notify] WhatsApp sent successfully');
        return response.status === 201 || response.status === 200;
    } catch (error: any) {
        console.error('[Notify] WhatsApp failed:', error.response?.data || error.message);
        return false;
    }
}

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
        const body = JSON.parse(event.body || '{}');
        const { lead_id, property_id, property_title, viewing_datetime, formatted_date } = body;

        if (!lead_id) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing lead_id' }) };
        }

        // Fetch lead details
        const { data: lead, error: leadError } = await supabase
            .from('leads')
            .select('email, phone, name')
            .eq('id', lead_id)
            .single();

        if (leadError || !lead) {
            console.error('[Notify] Lead not found:', leadError);
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'Lead not found' }) };
        }

        const booking: BookingNotification = {
            lead_id,
            lead_email: lead.email,
            lead_phone: lead.phone,
            lead_name: lead.name,
            property_title: property_title || 'Property Viewing',
            property_id: property_id || '',
            viewing_datetime: viewing_datetime || '',
            formatted_date: formatted_date || viewing_datetime
        };

        // Send both notifications
        const [emailSent, whatsappSent] = await Promise.all([
            sendEmailNotification(booking),
            sendWhatsAppNotification(booking)
        ]);

        // Log notification attempt
        await supabase.from('messages').insert({
            lead_id,
            type: 'System_Note',
            sender: 'System',
            content: `Booking notifications sent: Email=${emailSent}, WhatsApp=${whatsappSent}`
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                email_sent: emailSent,
                whatsapp_sent: whatsappSent
            })
        };

    } catch (error: any) {
        console.error('[Notify] Error:', error.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
