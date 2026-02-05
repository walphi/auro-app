
import axios from 'axios';

export interface TwilioSendResult {
    success: boolean;
    sid?: string;
    error?: string;
}

export class TwilioWhatsAppClient {
    private accountSid: string;
    private authToken: string;
    private from: string;

    constructor(accountSid?: string, authToken?: string, from?: string) {
        this.accountSid = accountSid || process.env.TWILIO_ACCOUNT_SID || '';
        this.authToken = authToken || process.env.TWILIO_AUTH_TOKEN || '';
        this.from = from || process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+12098994972';
        if (this.from.includes('14155238886')) this.from = 'whatsapp:+12098994972';
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
