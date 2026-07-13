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
                    from: 'AURO Insights <updates@auro-app.com>',
                    to: [email],
                    subject: 'Welcome to AURO Insights',
                    html: `
                        <div style="background:#0a0a0a;padding:40px 20px;font-family:sans-serif;">
                            <div style="max-width:560px;margin:0 auto;background:#111;border:1px solid #333;padding:40px;">
                                <h1 style="color:#D4FF00;font-size:24px;margin:0 0 8px;">AURO</h1>
                                <p style="color:#ccc;font-size:14px;line-height:1.6;">Hi ${name},</p>
                                <p style="color:#ccc;font-size:14px;line-height:1.6;">Welcome to the AURO Insights newsletter. You'll receive curated content on AI-powered lead nurturing, Dubai real estate trends, and product updates — delivered to your inbox twice a week.</p>
                                <p style="color:#ccc;font-size:14px;line-height:1.6;">Stay ahead of the curve.</p>
                                <p style="color:#666;font-size:12px;margin-top:24px;border-top:1px solid #333;padding-top:16px;">If you didn't sign up for this, you can ignore this email.</p>
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
