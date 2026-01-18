import { Handler } from '@netlify/functions';
import { getLeadById } from '../../lib/bitrixClient';
import { triggerLeadEngagement } from '../../lib/auroWhatsApp';

/**
 * Netlify Function: provident-bitrix-webhook
 * 
 * Endpoint for Bitrix24 ONCRMLEADADD event.
 * Validates request, fetches lead details, and triggers engagement.
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
        const leadId = body.data?.FIELDS?.ID;

        if (!leadId) {
            console.error('[Webhook] Invalid payload: Missing leadId');
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'invalid_payload' }),
            };
        }

        console.log(`[Webhook] Processing ONCRMLEADADD for lead ${leadId}`);

        // 4. Fetch full lead data from Bitrix24
        let bitrixLead;
        try {
            bitrixLead = await getLeadById(leadId);
        } catch (bitrixError: any) {
            console.error('[Webhook] Bitrix fetch error:', bitrixError.message);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'bitrix_error', message: 'Failed to fetch lead from CRM' }),
            };
        }

        // 5. Extract lead details
        // Phone numbers in Bitrix are often in an array
        const phone = bitrixLead.PHONE?.[0]?.VALUE;
        const name = bitrixLead.NAME || bitrixLead.TITLE || 'Value Home Seekers';
        const projectName = bitrixLead.TITLE || 'off-plan opportunities';

        if (!phone) {
            console.warn(`[Webhook] Lead ${leadId} has no phone number. Skipping WhatsApp engagement.`);
            return {
                statusCode: 200,
                body: JSON.stringify({
                    status: 'accepted',
                    leadId: leadId,
                    bitrixFetched: true,
                    whatsappTriggered: false,
                    reason: 'missing_phone'
                }),
            };
        }

        // 6. Trigger WhatsApp engagement flow
        const whatsappTriggered = await triggerLeadEngagement({
            phone: phone,
            name: name,
            projectName: projectName
        });

        if (!whatsappTriggered) {
            console.error(`[Webhook] Failed to trigger WhatsApp for lead ${leadId}`);
            // We still return 200/accepted because the lead *was* processed by Bitrix level
            // but we flag that WhatsApp failed.
        }

        // 7. Success response
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'accepted',
                event: body.event || 'ONCRMLEADADD',
                leadId: leadId,
                bitrixFetched: true,
                whatsappTriggered: whatsappTriggered
            }),
        };

    } catch (error: any) {
        console.error('[Webhook] Internal error:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'internal_error' }),
        };
    }
};
