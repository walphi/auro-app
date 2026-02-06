import * as dotenv from 'dotenv';
import { TwilioWhatsAppClient, resolveWhatsAppSender } from './lib/twilioWhatsAppClient';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

async function runStandaloneTest() {
    const testNumber = process.argv[2];
    const testMessage = process.argv[3] || "Hello! This is a standalone WhatsApp test from Auro App.";

    if (!testNumber) {
        console.error("Usage: npx tsx test_whatsapp_standalone.ts <phone_number> [message]");
        console.error("Example: npx tsx test_whatsapp_standalone.ts +971501234567");
        process.exit(1);
    }

    console.log("--- Standalone WhatsApp Test (No Bitrix) ---");
    console.log(`Target Number: ${testNumber}`);
    console.log(`Message: "${testMessage}"`);

    // Use current environment variables
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    // Fallback to TWILIO_PHONE_NUMBER if TWILIO_WHATSAPP_NUMBER is not set
    const fromNumber = resolveWhatsAppSender();

    console.log(`Using Account SID: ${accountSid?.substring(0, 10)}...`);
    console.log(`From Number: ${fromNumber}`);

    const client = new TwilioWhatsAppClient(accountSid, authToken, fromNumber);

    try {
        const result = await client.sendTextMessage(testNumber, testMessage);

        if (result.success) {
            console.log("\n✅ SUCCESS!");
            console.log(`Message SID: ${result.sid}`);
        } else {
            console.log("\n❌ FAILED");
            console.log(`Error: ${result.error}`);
        }
    } catch (error: any) {
        console.error("\n💥 EXCEPTION");
        console.error(error.message);
    }

    console.log("\n--- Test Complete ---");
}

runStandaloneTest();
