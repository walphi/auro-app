/**
 * End-to-end test: Cal.com booking → WhatsApp confirmation
 * Run: npx tsx --require dotenv/config test_booking_whatsapp.ts
 * (dotenv/config will auto-load .env before any imports)
 */

// Force .env.local loading FIRST (before any other imports)
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
// Also ensure SUPABASE_URL is set from VITE_ prefix if missing
if (!process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL) {
    process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL;
}

// Now do the imports
import { createCalComBooking } from './lib/calCom';
import { TwilioWhatsAppClient } from './lib/twilioWhatsAppClient';
import { createClient } from '@supabase/supabase-js';

async function main() {
    console.log('=== TEST: Cal.com Booking + WhatsApp Confirmation ===\n');

    // 1. Load tenant directly from Supabase (avoid tenantConfig import ordering issue)
    const supabase = createClient(
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    const { data: tenant, error: tErr } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', 1)
        .single();

    if (tErr || !tenant) {
        console.error('FAIL: Could not load tenant 1:', tErr?.message);
        process.exit(1);
    }
    console.log(`Tenant loaded: ${tenant.name} (id=${tenant.id})`);
    console.log(`twilio_whatsapp_number: ${tenant.twilio_whatsapp_number}`);
    console.log(`twilio_phone_number: ${tenant.twilio_phone_number}\n`);

    // 2. Create Cal.com booking (Random time to avoid conflict)
    const now = new Date();
    const future = new Date(now);
    future.setDate(future.getDate() + 5);
    // Random hour 10-16
    const randomHour = 10 + Math.floor(Math.random() * 6);
    future.setHours(randomHour, 0, 0, 0);

    const meetingStartIso = future.toISOString();
    console.log('--- Step 1: Cal.com Booking at', meetingStartIso, '---');
    let calResult: any;
    try {
        calResult = await createCalComBooking({
            eventTypeId: parseInt(process.env.CALCOM_EVENT_TYPE_ID_PROVIDENT || '4644939'),
            start: meetingStartIso,
            name: 'Philip Walsh',
            email: 'phillipwalsh@gmail.com',
            phoneNumber: '+971507150121',
            timeZone: 'Asia/Dubai',
        });
        console.log(`\n✅ Cal.com booking SUCCESS:`, JSON.stringify(calResult, null, 2));
    } catch (err: any) {
        console.error(`\n❌ Cal.com booking FAILED:`, err.message);
        process.exit(1);
    }

    // 3. Send WhatsApp Confirmation
    console.log('\n--- Step 2: WhatsApp Confirmation ---');
    const phone = '+971507150121';
    const firstName = 'Philip';
    const meetingUrl = calResult.meetingUrl || calResult.raw?.meetingUrl || '(no meeting URL)';

    console.log(`Messaging Service SID: ${process.env.TWILIO_MESSAGING_SERVICE_SID}`);
    console.log(`Recipient: ${phone}`);

    const client = new TwilioWhatsAppClient(
        tenant.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID,
        tenant.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN,
        process.env.TWILIO_MESSAGING_SERVICE_SID
    );

    const dateObj = new Date(meetingStartIso);
    const dateStr = dateObj.toLocaleString('en-US', { day: 'numeric', month: 'long', timeZone: 'Asia/Dubai' });
    const timeStr = dateObj.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Dubai' });

    const message = `Hi ${firstName}, your Provident consultation is confirmed for ${dateStr} at ${timeStr} (Dubai time). Join link: ${meetingUrl}\n\nYour property brochure: https://drive.google.com/file/d/1gKCSGYCO6ObmPJ0VRfk4b4TvKZl9sLuB/view`;

    console.log(`Message body: ${message}\n`);

    const result = await client.sendTextMessage(phone, message);

    if (result.success) {
        console.log(`\n✅ WhatsApp confirmation SENT. SID: ${result.sid}`);
    } else {
        console.error(`\n❌ WhatsApp confirmation FAILED:`, result.error);
    }

    console.log('\n=== TEST COMPLETE ===');
}

main().catch(console.error);
