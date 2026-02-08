
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
            const formattedFrom = this.from.startsWith('whatsapp:') ? this.from : `whatsapp:${this.from}`;

            params.append('To', formattedTo);
            params.append('From', formattedFrom);
            params.append('Body', body);

            console.log('[Twilio] sendTextMessage payload:', {
                to: formattedTo,
                from: formattedFrom,
                bodyLength: body.length,
                bodyPreview: body.substring(0, 120)
            });

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

            console.log('[Twilio] sendTextMessage success:', {
                sid: response.data.sid,
                status: response.data.status,
                to: response.data.to,
                from: response.data.from,
                dateCreated: response.data.date_created
            });

            return { success: true, sid: response.data.sid };
        } catch (error: any) {
            const twilioErr = error.response?.data;
            console.error("[Twilio] Error sending message:", {
                httpStatus: error.response?.status,
                twilioCode: twilioErr?.code,
                twilioMessage: twilioErr?.message,
                moreInfo: twilioErr?.more_info,
                errorMessage: error.message
            });
            return { success: false, error: twilioErr?.message || error.message };
        }
    }
}
