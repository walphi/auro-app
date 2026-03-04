/**
 * Local smoke-test for the Provident WhatsApp Content Template send path.
 *
 * Usage:
 *   npx tsx test_template_outreach.ts +971XXXXXXXXX "FirstName"
 *
 * Prerequisites:
 *   - .env.local must contain TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 *     TWILIO_MESSAGING_SERVICE_SID, and TWILIO_PROVIDENT_CONTENT_SID.
 *
 * This script sends a REAL WhatsApp message — use a personal test number,
 * never a live lead's number.
 */

import * as dotenv from 'dotenv';
import { TwilioWhatsAppClient } from './lib/twilioWhatsAppClient';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function run() {
    const phone = process.argv[2];
    const firstName = process.argv[3] || 'there';

    if (!phone) {
        console.error('Usage: npx tsx test_template_outreach.ts <phone> [firstName]');
        console.error('Example: npx tsx test_template_outreach.ts +971501234567 "Ahmed"');
        process.exit(1);
    }

    const contentSid = process.env.TWILIO_PROVIDENT_CONTENT_SID;
    if (!contentSid) {
        console.error('❌  TWILIO_PROVIDENT_CONTENT_SID is not set in .env.local');
        process.exit(1);
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const msgSvcSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

    console.log('--- Provident Template Outreach Test ---');
    console.log(`To:             ${phone}`);
    console.log(`First name:     ${firstName}`);
    console.log(`ContentSid:     ${contentSid}`);
    console.log(`MsgServiceSid:  ${msgSvcSid}`);
    console.log('');

    const client = new TwilioWhatsAppClient(accountSid, authToken, msgSvcSid);

    const result = await client.sendTemplateMessage(phone, contentSid, { '1': firstName });

    if (result.success) {
        console.log(`✅  SUCCESS  SID=${result.sid}`);
    } else {
        console.error(`❌  FAILED   ${result.error}`);
        process.exit(1);
    }

    console.log('--- Test Complete ---');
}

run().catch((err) => {
    console.error('💥  EXCEPTION', err.message);
    process.exit(1);
});
