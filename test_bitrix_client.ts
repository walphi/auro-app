import { getLeadById } from './lib/bitrixClient';
import * as dotenv from 'dotenv';

// Load environment variables from .env or .env.local
dotenv.config({ path: '.env.local' });

async function testBitrix() {
    const leadId = process.argv[2];

    if (!leadId) {
        console.error('Usage: npx tsx test_bitrix_client.ts <lead_id>');
        process.exit(1);
    }

    const webhookUrl = process.env.BITRIX_WEBHOOK_URL;
    if (!webhookUrl) {
        console.error('Error: BITRIX_WEBHOOK_URL not found in environment.');
        console.log('Please set it in .env.local before running this test.');
        process.exit(1);
    }

    console.log('--- Bitrix24 Client Test ---');
    console.log('Webhook URL:', webhookUrl.replace(/\/rest\/\d+\/[a-z0-9]+/, '/rest/[REDACTED]'));
    console.log('Lead ID:', leadId);

    try {
        // Multi-tenant usage: passing the webhook URL explicitly
        const lead = await getLeadById(leadId, webhookUrl);
        console.log('\nSuccess (Multi-tenant mode)! Lead data:');
        console.log(JSON.stringify(lead, null, 2));

        // Backward compatibility usage: relying on env var
        // const leadLegacy = await getLeadById(leadId);
    } catch (error: any) {
        console.error('\nTest Failed:', error.message);
    }
}

testBitrix();
