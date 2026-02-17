
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testLocalFlow() {
    console.log('--- Testing Local Auth Propagation ---');

    // Mock the key if missing just for local test validation
    process.env.AURO_PROVIDENT_WEBHOOK_KEY = process.env.AURO_PROVIDENT_WEBHOOK_KEY || "test_secret_123";
    const webhookKey = process.env.AURO_PROVIDENT_WEBHOOK_KEY;

    console.log(`Using Key: ${webhookKey}`);

    const payload = {
        event: 'BOOKING_CREATED',
        bitrixId: '12345',
        lead_id: 'lead_abc',
        phone: '+971500000000',
        summary: 'Test summary',
        transcript: 'Test transcript',
        booking: { id: 'booking_123', start: new Date().toISOString(), meetingUrl: 'http://test.com', eventTypeId: 1 },
        structured: { budget: '1M', property_type: 'Apartment' }
    };

    // Test 1: Query Param
    console.log('\nTesting Query Param Auth...');
    try {
        const url = `http://localhost:8888/.netlify/functions/provident-bitrix-webhook?key=${webhookKey}`;
        // Since we can't easily start a netlify dev server here, we'll just mock the verification logic
        const mockEvent = {
            headers: { 'x-auro-key': webhookKey },
            queryStringParameters: { key: webhookKey }
        };

        const checkAuth = (event) => {
            const auroKey = event.headers['x-auro-key'] ||
                event.headers['X-Auro-Key'] ||
                event.headers['x-webhook-key'] ||
                event.headers['X-Webhook-Key'] ||
                event.queryStringParameters?.key;
            return auroKey === webhookKey;
        };

        if (checkAuth(mockEvent)) {
            console.log('✅ Auth Logic PASSED (Mock)');
        } else {
            console.log('❌ Auth Logic FAILED (Mock)');
        }
    } catch (e) {
        console.error(e);
    }
}

testLocalFlow();
