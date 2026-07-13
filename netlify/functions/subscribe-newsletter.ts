import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const RESEND_API_KEY = process.env.RESEND_API_KEY;

interface SubscribeBody {
    name: string;
    email: string;
    source?: string;
}

export const handler: Handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    try {
        const body: SubscribeBody = JSON.parse(event.body || '{}');
        const { name, email, source } = body;

        if (!name || !email) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Name and email are required' }) };
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email address' }) };
        }

        // Check if already subscribed
        const { data: existing } = await supabase
            .from('subscribers')
            .select('id, status')
            .eq('email', email)
            .maybeSingle();

        if (existing) {
            if (existing.status === 'active') {
                return { statusCode: 409, headers, body: JSON.stringify({ error: 'Already subscribed' }) };
            }
            // Re-subscribe if previously unsubscribed
            await supabase
                .from('subscribers')
                .update({ status: 'active', name, source: source || 'footer' })
                .eq('id', existing.id);
        } else {
            // Insert new subscriber
            const { error: insertError } = await supabase
                .from('subscribers')
                .insert({ name, email, source: source || 'footer' });

            if (insertError) {
                console.error('[Subscribe] Insert error:', insertError);
                return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to subscribe' }) };
            }
        }

        // Send welcome email via Resend
        if (RESEND_API_KEY) {
            try {
                await axios.post('https://api.resend.com/emails', {
                    from: 'AURO Insights <hello@insights.auroapp.com>',
                    to: [email],
                    subject: 'Welcome to AURO Insights',
                    html: `
                        <div style="background:#0a0a0a;padding:40px 20px;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
                            <div style="max-width:560px;margin:0 auto;background:#0b0b0bed;border:1px solid #333;padding:40px;">

                                <!-- brandmark -->
                                <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
                                    <tr>
                                        <td style="vertical-align:middle;padding:0 10px 0 0;">
                                            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#D4FF00;line-height:10px;">&nbsp;</span>
                                        </td>
                                        <td style="vertical-align:middle;color:#D4FF00;font-size:14px;letter-spacing:.2em;font-family:'Courier New',monospace;text-transform:uppercase;font-weight:bold;">AURO</td>
                                    </tr>
                                </table>
                                <div style="height:1px;background:#333;margin:0 0 28px 0;"></div>

                                <p style="margin:0 0 6px 0;color:#D4FF00;font-size:11px;letter-spacing:.2em;font-family:'Courier New',monospace;text-transform:uppercase;">// WELCOME</p>

                                <h1 style="margin:0 0 16px 0;color:#f4f4f4;font-size:30px;font-style:italic;font-family:Georgia,'Times New Roman',serif;font-weight:normal;line-height:1.25;">You're in.</h1>

                                <p style="margin:0 0 14px 0;color:#aaaaaa;font-size:15px;line-height:1.65;">Hi ${name},</p>
                                <p style="margin:0 0 14px 0;color:#aaaaaa;font-size:15px;line-height:1.65;">Thanks for subscribing to <strong style="color:#ffffff;">AURO Insights</strong>. A curated digest lands in your inbox every <strong style="color:#ffffff;">Monday and Thursday at 9am GST</strong> &mdash; Dubai real estate signals, AI lead nurturing patterns, and the operational moves we're seeing work.</p>
                                <p style="margin:18px 0 0 0;color:#aaaaaa;font-size:15px;line-height:1.65;">Stay ahead of the curve.<span aria-hidden="true">&nbsp;🚀</span></p>

                                <p style="margin:32px 0 4px 0;color:#D4FF00;font-size:11px;letter-spacing:.2em;font-family:'Courier New',monospace;text-transform:uppercase;">// NEXT</p>
                                <p style="margin:0;color:#aaaaaa;font-size:14px;line-height:1.6;">Your first digest arrives this Thursday &mdash; or next Monday if you signed up mid-week.<span aria-hidden="true">&nbsp;📅</span></p>

                                <div style="height:1px;background:#333;margin:32px 0 16px 0;"></div>
                                <p style="margin:0;color:#666;font-size:11px;line-height:1.5;">If this wasn't you, ignore this email &mdash; your address won't be added.</p>

                            </div>
                        </div>
                    `
                }, {
                    headers: {
                        'Authorization': `Bearer ${RESEND_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });
                console.log('[Subscribe] Welcome email sent to', email);
            } catch (emailError: any) {
                console.error('[Subscribe] Welcome email failed:', emailError.response?.data || emailError.message);
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Subscribed successfully' })
        };

    } catch (error: any) {
        console.error('[Subscribe] Error:', error.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
