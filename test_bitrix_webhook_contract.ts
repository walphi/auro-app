/**
 * Bitrix Contract Validation Test
 * Verifies that the /.netlify/functions/provident-bitrix-webhook 
 * matches the payload contract required for Vapi results.
 * 
 * Run: npx tsx --require dotenv/config test_bitrix_webhook_contract.ts
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const WEBHOOK_URL = 'https://auroapp.com/.netlify/functions/provident-bitrix-webhook';
const AURO_KEY = process.env.AURO_PROVIDENT_WEBHOOK_KEY || process.env.VAPI_WEBHOOK_SECRET;

async function runTest() {
    console.log('=== Bitrix Contract Validation Test ===\n');

    if (!AURO_KEY) {
        console.error('❌ FAIL: AURO_PROVIDENT_WEBHOOK_KEY is not set in environment.');
        process.exit(1);
    }

    // Contract Payload (Known-Good Example)
    const testPayload = {
        event: 'BOOKING_CREATED',
        bitrixId: '1060275', // Test ID
        lead_id: 'test-lead-123',
        tenant_id: 1,
        phone: '+971500000000',
        summary: 'Automated contract test summary.',
        transcript: 'Automated contract test transcript.',
        source: 'Auro Test Script',
        booking: {
            id: 'cal-test-999',
            start: new Date().toISOString(),
            meetingUrl: 'https://cal.com/test-meeting',
            eventTypeId: 4644939
        },
        structured: {
            budget: '1.5M AED',
            property_type: 'Apartment',
            preferred_area: 'Dubai Marina',
            meetingscheduled: true,
            meetingstartiso: new Date().toISOString()
        }
    };

    console.log(`Checking payload contract: /.netlify/functions/provident-bitrix-webhook...`);

    try {
        const response = await axios.post(WEBHOOK_URL, testPayload, {
            headers: {
                'x-auro-key': AURO_KEY,
                'Content-Type': 'application/json'
            }
        });

        console.log(`\n✅ STATUS: ${response.status}`);
        console.log(`✅ RESPONSE:`, JSON.stringify(response.data, null, 2));

        if (response.data.status === 'success' || response.data.status === 'accepted' || response.status === 200) {
            console.log('\n✨ CONTRACT VALIDATED SUCCESSFULLY');
        } else {
            console.error('\n❌ CONTRACT VALIDATION FAILED: Unexpected response status');
            process.exit(1);
        }
    } catch (error: any) {
        console.error(`\n❌ HTTP ERROR: status=${error.response?.status} body=${JSON.stringify(error.response?.data || error.message)}`);
        process.exit(1);
    }
}

runTest();
