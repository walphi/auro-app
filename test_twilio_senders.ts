import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testTwilioSenders() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        console.error('Missing Twilio credentials');
        return;
    }

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    console.log('🔍 Testing Twilio WhatsApp Senders...\n');
    console.log(`Account SID: ${accountSid}\n`);

    // Test different sender configurations
    const sendersToTest = [
        { name: 'UAE Number (Raw)', from: '+971565203832' },
        { name: 'UAE Number (WhatsApp)', from: 'whatsapp:+971565203832' },
        { name: 'Sandbox', from: 'whatsapp:+14155238886' },
        { name: 'Old US Number', from: 'whatsapp:+12098994972' }
    ];

    const testRecipient = 'whatsapp:+971501234567'; // Replace with your test number

    for (const sender of sendersToTest) {
        console.log(`\n📞 Testing: ${sender.name}`);
        console.log(`   From: ${sender.from}`);

        try {
            const params = new URLSearchParams();
            params.append('To', testRecipient);
            params.append('From', sender.from);
            params.append('Body', `Test from ${sender.name} at ${new Date().toISOString()}`);

            const response = await axios.post(
                `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
                params,
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            console.log(`   ✅ SUCCESS`);
            console.log(`   SID: ${response.data.sid}`);
            console.log(`   Status: ${response.data.status}`);
        } catch (error: any) {
            console.log(`   ❌ FAILED`);
            console.log(`   Error: ${error.response?.data?.code} - ${error.response?.data?.message}`);
            if (error.response?.data?.more_info) {
                console.log(`   More info: ${error.response.data.more_info}`);
            }
        }
    }

    console.log('\n\n📋 Summary:');
    console.log('The sender that shows ✅ SUCCESS is the one you should use in your code.');
    console.log('Update the database or environment variables to use that sender.');
}

testTwilioSenders().catch(console.error);
