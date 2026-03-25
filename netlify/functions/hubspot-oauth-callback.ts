import { Handler } from '@netlify/functions';
import axios from 'axios';
import { supabase } from '../../lib/supabase';

/**
 * netlify/functions/hubspot-oauth-callback.ts
 *
 * Minimal, non-timing-out OAuth callback for HubSpot.
 * Handles code exchange, token persistence, and redirects.
 */

const HS_TOKEN_URL = 'https://api.hubapi.com/oauth/v3/token';
const BASE_URL = process.env.URL || 'https://auroapp.com';

export const handler: Handler = async (event) => {
    console.log('[HubSpotOAuth] Callback received');

    const { code, state } = event.queryStringParameters || {};

    const errorRedirect = (reason: string) => ({
        statusCode: 302,
        headers: { Location: `${BASE_URL}/eshel/hubspot-error?error=${encodeURIComponent(reason)}` },
        body: '',
    });

    if (!code || !state) {
        console.error('[HubSpotOAuth] Missing code or state');
        return errorRedirect('missing_params');
    }

    const tenantId = parseInt(state, 10);
    if (isNaN(tenantId)) {
        console.error(`[HubSpotOAuth] Invalid state: ${state}`);
        return errorRedirect('invalid_tenant');
    }

    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
    const redirectUri = process.env.HUBSPOT_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
        console.error('[HubSpotOAuth] Missing env vars');
        return errorRedirect('server_config_error');
    }

    try {
        // 1. Verify tenant exists
        const { data: tenant, error: tenantErr } = await supabase
            .from('tenants')
            .select('id, short_name, hubspot_label')
            .eq('id', tenantId)
            .single();

        if (tenantErr || !tenant) {
            console.error(`[HubSpotOAuth] Tenant ${tenantId} not found`);
            return errorRedirect('tenant_not_found');
        }

        // 2. Exchange code for tokens
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code,
        });

        const resp = await axios.post(HS_TOKEN_URL, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const { access_token, refresh_token, expires_in, hub_id, scopes } = resp.data;
        const expires_at = new Date(Date.now() + (expires_in || 1800) * 1000).toISOString();
        const hubspot_label = tenant.hubspot_label || tenant.short_name.toLowerCase().replace(/\s+/g, '_');

        // 3. Upsert tokens
        const { error: upsertErr } = await supabase
            .from('hubspot_tokens')
            .upsert({
                tenant_id: tenantId,
                hubspot_portal_id: hub_id,
                hubspot_portal_name: `${tenant.short_name} HubSpot`,
                hubspot_label,
                access_token,
                refresh_token,
                scopes: Array.isArray(scopes) ? scopes.join(' ') : (scopes || ''),
                expires_at,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'tenant_id' });

        if (upsertErr) throw upsertErr;

        // 4. Ensure tenant crm_type is set
        await supabase
            .from('tenants')
            .update({ crm_type: 'hubspot', hubspot_label })
            .eq('id', tenantId);

        console.log(`[tenant=${tenantId}][HubSpotOAuth] Success for Portal ${hub_id}`);

        return {
            statusCode: 302,
            headers: { Location: `${BASE_URL}/eshel/hubspot-connected` },
            body: '',
        };
    } catch (err: any) {
        const detail = err.response?.data?.message || err.message;
        console.error(`[tenant=${tenantId}][HubSpotOAuth] Failed:`, detail);
        return errorRedirect(detail);
    }
};

