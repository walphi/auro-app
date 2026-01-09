import { Handler } from '@netlify/functions';
import axios from 'axios';
import * as querystring from 'querystring';
import { supabase } from '../../lib/supabase';
import { processAgentSitesMessage, AgentSitesInboundMessage } from '../../lib/agentSitesConversation';
import { TwilioWhatsAppClient } from '../../lib/twilioWhatsAppClient';

export const handler: Handler = async (event) => {
    // 1. Log incoming webhook details (for both real Twilio and CLI simulation)
    console.log("[AgentSites] Incoming webhook", {
        path: event.path,
        httpMethod: event.httpMethod,
        contentType: event.headers["content-type"] || event.headers["Content-Type"],
        rawBody: event.body,
    });

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const body = querystring.parse(event.body || "");

        // 2. Log parsed Twilio params
        console.log("[AgentSites] Parsed Twilio params", {
            From: body.From,
            To: body.To,
            WaId: body.WaId,
            Body: body.Body,
            ProfileName: body.ProfileName,
            SmsMessageSid: body.SmsMessageSid,
            MessageSid: body.MessageSid,
        });

        // 3. Detect and log webhook origin
        const hasSignature = !!event.headers["x-twilio-signature"] || !!event.headers["X-Twilio-Signature"];
        console.log("[AgentSites] Webhook origin", {
            origin: hasSignature ? "twilio" : "local_simulation",
        });

        const from = ((body.From as string) || "").replace('whatsapp:', '');
        const text = (body.Body as string) || "";
        const mediaUrls: string[] = [];

        const numMedia = parseInt((body.NumMedia as string) || "0", 10);
        for (let i = 0; i < numMedia; i++) {
            const url = body[`MediaUrl${i}`] as string;
            if (url) mediaUrls.push(url);
        }

        if (!from) {
            console.error('[AgentSites] Could not identify sender (From) from Twilio payload');
            return { statusCode: 200, body: '<Response/>' };
        }

        // 1. Find or Create Agent
        let { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('*')
            .eq('phone', from)
            .single();

        if (!agent) {
            const { data: newAgent, error: createError } = await supabase
                .from('agents')
                .insert({
                    phone: from,
                    status: 'onboarding'
                })
                .select()
                .single();

            if (createError) throw createError;
            agent = newAgent;
        }

        // Setup proactive sender for Twilio
        const twilioClient = new TwilioWhatsAppClient();

        const agentMsg: AgentSitesInboundMessage = {
            from,
            text,
            mediaUrls,
            platform: 'twilio'
        };

        // Multi-Agent Orchestrator Delegation (via Edge Intents)
        const apiBase = (process.env.URL || process.env.VITE_API_BASE_URL || 'http://localhost:8888').trim();
        const edgeIntentsUrl = `${apiBase}/edge/intents`;
        const orchestratorUrl = `${apiBase}/.netlify/functions/orchestrator`;

        console.log(`[AgentSites] Delegating to Edge Intents: ${edgeIntentsUrl}`);

        let resultText = "";
        try {
            // 1. Get standardized intent from Edge
            const edgeResponse = await axios.post(edgeIntentsUrl, {
                action: "handle_message",
                agentId: agent.id,
                from: from,
                payload: { text, mediaUrls }
            });

            const intent = edgeResponse.data;
            console.log(`[AgentSites] Received Intent from Edge:`, JSON.stringify(intent));

            // 2. Forward Intent to Orchestrator
            const orchestratorResponse = await axios.post(orchestratorUrl, intent);
            resultText = orchestratorResponse.data?.text || "I'm processing your request.";

        } catch (e: any) {
            console.error("[AgentSites] Edge/Orchestrator error, falling back to legacy:", e.message);
            // Fallback to legacy processAgentSitesMessage
            const result = await processAgentSitesMessage(agentMsg, async (proactiveText: string) => {
                console.log(`[Twilio Proactive] Sending to ${from}: ${proactiveText}`);
                await twilioClient.sendTextMessage(from, proactiveText);
            });
            resultText = result?.text || "";
        }

        const twiml = resultText
            ? `<Response><Message>${resultText}</Message></Response>`
            : `<Response/>`;

        // 4. Log conversation outcome (limited fields as intent/state are internal to state machine)
        console.log("[AgentSites] Conversation outcome", {
            from,
            replyPreview: twiml.slice(0, 200),
        });

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/xml' },
            body: twiml
        };
    } catch (error: any) {
        console.error('[AgentSites] Error in whatsapp-agent-sites handler:', error);
        return {
            statusCode: 200, // Return 200 with empty TwiML to avoid Twilio error retries
            headers: { 'Content-Type': 'text/xml' },
            body: `<Response><!-- Error: ${error.message} --></Response>`
        };
    }
};
