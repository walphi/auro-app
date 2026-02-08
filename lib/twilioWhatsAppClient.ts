
import axios from 'axios';

export interface TwilioSendResult {
    success: boolean;
    sid?: string;
    error?: string;
}

export function resolveWhatsAppSender(tenant?: { twilio_whatsapp_number?: string, twilio_phone_number?: string }): string {
    // 1. Prefer tenant explicit WhatsApp number
    let sender = tenant?.twilio_whatsapp_number;

    // 2. Fallback to tenant phone number
    if (!sender) sender = tenant?.twilio_phone_number;

    // 3. Fallback to Env Vars
    if (!sender) sender = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER;

    // 4. Fallback to Production Default (if everything else is missing)
    if (!sender) sender = '+12098994972';

    // 5. Sandbox Guard: strictly block +14155238886
    if (sender.includes('14155238886')) {
        console.warn(`[WhatsApp] Blocked usage of sandbox number ${sender}, swapping to production default.`);
        sender = '+12098994972';
    }

    // 6. Format
    return sender.startsWith('whatsapp:') ? sender : `whatsapp:${sender}`;
}

export class TwilioWhatsAppClient {
    private accountSid: string;
    private authToken: string;
    private from: string;

    constructor(accountSid?: string, authToken?: string, from?: string) {
        this.accountSid = accountSid || process.env.TWILIO_ACCOUNT_SID || '';
        this.authToken = authToken || process.env.TWILIO_AUTH_TOKEN || '';

        // Use the resolution logic with an empty tenant to get the env-based default
        this.from = from ? resolveWhatsAppSender({ twilio_whatsapp_number: from }) : resolveWhatsAppSender();
    }

    async sendTextMessage(to: string, body: string): Promise<TwilioSendResult> {
        try {
            if (!this.accountSid || !this.authToken) {
                throw new Error("Missing Twilio credentials.");
            }

            const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
            const params = new URLSearchParams();

            // Ensure whatsapp: prefix
            const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

            // Check for Messaging Service SID
            const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

            params.append('To', formattedTo);

            if (messagingServiceSid) {
                // Use Messaging Service
                params.append('MessagingServiceSid', messagingServiceSid);
                // console.log(`[Twilio] Using Messaging Service: ${messagingServiceSid}`);
            } else {
                // Use direct From number
                const formattedFrom = this.from ? (this.from.startsWith('whatsapp:') ? this.from : `whatsapp:${this.from}`) : '';
                if (formattedFrom) {
                    params.append('From', formattedFrom);
                }
            }

            params.append('Body', body);

            const response = await axios.post(
                `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
                params,
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            return { success: true, sid: response.data.sid };
        } catch (error: any) {
            console.error("[Twilio] Error sending message:", error.message);
            return { success: false, error: error.message };
        }
    }
}
