
import { Handler } from '@netlify/functions';
import { BirdClient } from '../../lib/birdClient';
import { processAgentSitesMessage, AgentSitesInboundMessage } from '../../lib/agentSitesConversation';

const {
    BIRD_API_KEY,
    BIRD_WORKSPACE_ID,
    BIRD_WHATSAPP_CHANNEL_ID
} = process.env;

const defaultBird = new BirdClient(
    BIRD_API_KEY || '',
    BIRD_WORKSPACE_ID || '',
    BIRD_WHATSAPP_CHANNEL_ID || ''
);

export const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const fullBody = JSON.parse(event.body || '{}');
        console.log("FULL BIRD PAYLOAD:", JSON.stringify(fullBody, null, 2));

        // 1. Identify "message" object (Bird has multiple formats)
        const message = fullBody.payload || fullBody.message || fullBody.data;

        if (!message) {
            console.log("No payload/message/data found in Bird event, ignoring.");
            return { statusCode: 200, body: 'No message data' };
        }

        // 2. Extract key fields
        const from = message.sender?.contact?.identifierValue ||
            message.sender?.contacts?.[0]?.identifierValue ||
            message.sender?.identifierValue;

        const incomingChannelId = message.channelId || fullBody.channelId;
        const text = message.body?.text?.text || '';

        if (!from) {
            console.error('Could not identify sender (from) from Bird payload');
            return { statusCode: 200, body: 'No sender identified' };
        }

        console.log(`Incoming Bird message from ${from} on channel ${incomingChannelId}: "${text}"`);

        // 3. Setup Bird Client for this request
        const requestBird = incomingChannelId
            ? new BirdClient(BIRD_API_KEY || '', BIRD_WORKSPACE_ID || '', incomingChannelId)
            : defaultBird;

        // 4. Process via shared handler
        const agentMsg: AgentSitesInboundMessage = {
            from,
            text,
            platform: 'bird'
        };

        const result = await processAgentSitesMessage(agentMsg, async (proactiveText: string) => {
            console.log(`[Bird Proactive] Sending to ${from}: ${proactiveText}`);
            await requestBird.sendTextMessage(from, proactiveText);
        });

        if (result && result.text) {
            console.log(`[Bird Reply] Replying to ${from}: ${result.text}`);
            await requestBird.sendTextMessage(from, result.text);
        }

        return { statusCode: 200, body: 'ok' };
    } catch (error: any) {
        console.error('Error in whatsapp-bird handler:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
