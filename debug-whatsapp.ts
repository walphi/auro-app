
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * REPLICATED HELPERS FROM vapi.ts
 */
function buildWhatsappConfirmationMessage(firstName: string, meetingStartIso: string, meetingUrl?: string): string {
    const dateObj = new Date(meetingStartIso);
    const dayName = dateObj.toLocaleString('en-US', { weekday: 'long', timeZone: 'Asia/Dubai' });
    const dateStr = dateObj.toLocaleString('en-US', { day: 'numeric', month: 'long', timeZone: 'Asia/Dubai' });
    const timeStr = dateObj.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Dubai' });

    let message = `Hi ${firstName}, your consultation with Provident is confirmed for ${dayName}, ${dateStr} at ${timeStr} (Dubai time). You’ll receive a calendar invite by email. If you need to reschedule, just reply to this message.`;

    if (meetingUrl) {
        message += `\n\nHere is your meeting link: ${meetingUrl}`;
    }

    return message;
}

async function sendWhatsAppMessage(to: string, text: string): Promise<any> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    let from = process.env.TWILIO_PHONE_NUMBER || 'whatsapp:+12098994972';
    if (from.includes('14155238886')) from = 'whatsapp:+12098994972';

    console.log('[WhatsApp] REQUEST:', { to, from, body: text });

    if (!accountSid || !authToken) throw new Error("Missing Twilio credentials");

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const params = new URLSearchParams();
    params.append('To', to.startsWith('whatsapp:') ? to : `whatsapp:${to}`);
    params.append('From', from.startsWith('whatsapp:') ? from : `whatsapp:${from}`);
    params.append('Body', text);

    try {
        const response = await axios.post(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
            params,
            { headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        return response.data;
    } catch (error: any) {
        return { error: error.response?.data || error.message };
    }
}

async function runTest() {
    console.log("--- Starting WhatsApp Confirmation Simulation ---");

    // 1. Fetch latest booking + lead
    const { data: booking, error: bError } = await supabase
        .from('bookings')
        .select('*, leads(*)')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (bError || !booking) {
        console.error("❌ Could not find latest booking", bError);
        return;
    }

    const lead = (booking as any).leads;
    const firstName = lead?.name?.split(' ')[0] || 'Client';
    const meetingStartIso = booking.meeting_start_iso;
    const meetingUrl = booking.meta?.meeting_url;

    // 2. Phone Selection Logic (Mirroring vapi.ts)
    const phoneFromBooking = (booking.meta?.structured_data?.phone) || '+971507150121';
    const phoneForWhatsapp = lead?.phone || phoneFromBooking;

    console.log('[WhatsApp] Found Booking:', booking.booking_id);
    console.log('[WhatsApp] Lead Name:', lead?.name);
    console.log('[WhatsApp] Using phone:', phoneForWhatsapp);

    // 3. Build Message
    const message = buildWhatsappConfirmationMessage(firstName, meetingStartIso, meetingUrl);

    // 4. Send
    const result = await sendWhatsAppMessage(phoneForWhatsapp, message);

    console.log('[WhatsApp] RAW RESPONSE:', JSON.stringify(result, null, 2));
}

runTest();
