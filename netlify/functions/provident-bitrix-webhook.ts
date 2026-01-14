import { Handler } from '@netlify/functions';
import { getLeadById } from '../../lib/bitrixClient';
import { triggerLeadEngagement } from '../../lib/auroWhatsApp';

/**
 * Netlify Function: provident-bitrix-webhook
 * 
 * Endpoint for Bitrix24 ONCRMLEADADD event.
 * Validates request, logs payload, and stubs future processing.
 */
export const handler: Handler = async (event, context) => {
    // 1. Ensure the request is POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'method_not_allowed' }),
        };
    }

    // 2. Read and validate custom header: x-auro-key
    const auroKey = event.headers['x-auro-key'];
    const validKey = process.env.AURO_PROVIDENT_WEBHOOK_KEY;

    if (!auroKey || auroKey !== validKey) {
        console.error('[Webhook] Unauthorized access attempt');
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'unauthorized' }),
        };
    }

    try {
        // 3. Parse and validate the JSON body
        if (!event.body) {
            throw new Error('Missing body');
        }

        const body = JSON.parse(event.body);
        console.log('[Webhook] Received Bitrix24 payload:', JSON.stringify(body, null, 2));

        // Expecting Bitrix24 event payload structure
        // data.FIELDS.ID is the LEAD_ID for ONCRMLEADADD
        const leadId = body.data?.FIELDS?.ID;

        if (!leadId) {
            console.error('[Webhook] Invalid payload: Missing leadId (data.FIELDS.ID)');
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'invalid_payload' }),
            };
        }

        // 4. Future logic stubs
        // In the next iteration, we will:
        // a) Fetch full lead details using bitrixClient.getLeadById(leadId)
        // b) Pass detail to auroWhatsApp.triggerLeadEngagement(leadId, leadData)
        // For now, we just log.

        console.log(`[Webhook] Successfully accepted lead ${leadId}. Ready for Phase One processing.`);

        // 5. Return success response
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'accepted',
                event: body.event || 'ONCRMLEADADD',
                leadId: leadId
            }),
        };

    } catch (error) {
        console.error('[Webhook] Internal error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'internal_error' }),
        };
    }
};
