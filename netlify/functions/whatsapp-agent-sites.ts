
import { Handler } from '@netlify/functions';
import * as querystring from 'querystring';
import { processAgentSitesMessage, AgentSitesInboundMessage } from '../../lib/agentSitesConversation';
import { TwilioWhatsAppClient } from '../../lib/twilioWhatsAppClient';

export const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const body = querystring.parse(event.body || "");
        console.log("FULL TWILIO PAYLOAD:", JSON.stringify(body, null, 2));

        const from = ((body.From as string) || "").replace('whatsapp:', '');
        const text = (body.Body as string) || "";
        const mediaUrls: string[] = [];

        const numMedia = parseInt((body.NumMedia as string) || "0", 10);
        for (let i = 0; i < numMedia; i++) {
            const url = body[`MediaUrl${i}`] as string;
            if (url) mediaUrls.push(url);
        }

        if (!from) {
            console.error('Could not identify sender (From) from Twilio payload');
            return { statusCode: 200, body: '<Response/>' };
        }

        console.log(`Incoming Twilio message from ${from}: "${text}"`);

        // Setup proactive sender for Twilio
        // We might need to use a specific number for Agent Sites if configured differently later
        const twilioClient = new TwilioWhatsAppClient();

        const agentMsg: AgentSitesInboundMessage = {
            from,
            text,
            mediaUrls,
            platform: 'twilio'
        };

        const result = await processAgentSitesMessage(agentMsg, async (proactiveText: string) => {
            console.log(`[Twilio Proactive] Sending to ${from}: ${proactiveText}`);
            await twilioClient.sendTextMessage(from, proactiveText);
        });

        const twiml = result?.text
            ? `<Response><Message>${result.text}</Message></Response>`
            : `<Response/>`;

        console.log(`[Twilio TwiML] Replying to ${from}: ${twiml}`);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/xml' },
            body: twiml
        };
    } catch (error: any) {
        console.error('Error in whatsapp-agent-sites handler:', error);
        return {
            statusCode: 200, // Return 200 with empty TwiML to avoid Twilio error retries
            headers: { 'Content-Type': 'text/xml' },
            body: `<Response><!-- Error: ${error.message} --></Response>`
        };
    }
};
