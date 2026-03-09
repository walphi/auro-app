import { Handler } from '@netlify/functions';
import axios from 'axios';
import { supabase } from '../../lib/supabase';


const HS_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';

export const handler: Handler = async (event) => {
    console.log('[HubSpotOAuth] Callback received');

    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: JSON.stringify({ error: 'method_not_allowed' }) };
    }

    const { code, state } = event.queryStringParameters || {};

    // --- Validate required params ---
    if (!code || !state) {
        console.error('[HubSpotOAuth] Missing code or state query param');
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'missing_params', detail: 'code and state are required' }),
        };
    }

    const tenantId = parseInt(state, 10);
    if (isNaN(tenantId) || tenantId < 1) {
        console.error(`[HubSpotOAuth] Invalid state value: ${state}`);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'invalid_state', detail: 'state must be a valid tenant ID' }),
        };
    }

    // --- Validate env vars ---
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
    const redirectUri = process.env.HUBSPOT_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
        console.error('[HubSpotOAuth] Missing HUBSPOT_CLIENT_ID / HUBSPOT_CLIENT_SECRET / HUBSPOT_REDIRECT_URI env vars');
        return { statusCode: 500, body: JSON.stringify({ error: 'server_misconfiguration' }) };
    }

    // --- Validate that the tenant exists in Supabase ---
    const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id, short_name, hubspot_label')
        .eq('id', tenantId)
        .single();

    if (tenantError || !tenant) {
        console.error(`[HubSpotOAuth] Tenant ${tenantId} not found:`, tenantError?.message);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'unknown_tenant', detail: `No tenant found with id=${tenantId}` }),
        };
    }

    console.log(`[tenant=${tenantId}|${tenant.short_name}][HubSpotOAuth] Exchanging code for tokens...`);

    // --- Exchange code for tokens ---
    let tokenData: any;
    try {
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

        tokenData = resp.data;
    } catch (err: any) {
        const detail = err.response?.data;
        console.error(`[tenant=${tenantId}][HubSpotOAuth] Token exchange failed:`, detail || err.message);
        return {
            statusCode: 502,
            body: JSON.stringify({
                error: 'hubspot_token_error',
                detail: detail?.message || err.message,
            }),
        };
    }

    const { access_token, refresh_token, expires_in, hub_id, scopes } = tokenData;
    const expires_at = new Date(Date.now() + (expires_in || 1800) * 1000).toISOString();
    const hubspot_label = tenant.hubspot_label || tenant.short_name.toLowerCase().replace(/\s+/g, '_');

    console.log(`[tenant=${tenantId}|${hubspot_label}][HubSpotOAuth] Tokens received. Portal ID: ${hub_id}. Expires: ${expires_at}`);

    // --- Upsert tokens into hubspot_tokens ---
    const { error: upsertError } = await supabase
        .from('hubspot_tokens')
        .upsert(
            {
                tenant_id: tenantId,
                hubspot_portal_id: hub_id,
                hubspot_portal_name: `${tenant.short_name} HubSpot`,
                hubspot_label,
                access_token,
                refresh_token,
                scopes: Array.isArray(scopes) ? scopes.join(' ') : (scopes || ''),
                expires_at,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'tenant_id' }
        );

    if (upsertError) {
        console.error(`[tenant=${tenantId}][HubSpotOAuth] Supabase upsert failed:`, upsertError.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'database_error', detail: upsertError.message }),
        };
    }

    // --- Ensure tenants row has crm_type and hubspot_label set ---
    const { error: tenantUpdateError } = await supabase
        .from('tenants')
        .update({ crm_type: 'hubspot', hubspot_label })
        .eq('id', tenantId);

    if (tenantUpdateError) {
        // Non-fatal — token is saved. Log and continue.
        console.warn(`[tenant=${tenantId}][HubSpotOAuth] Could not update tenant crm_type:`, tenantUpdateError.message);
    }

    console.log(`[tenant=${tenantId}|${hubspot_label}][HubSpotOAuth] Install complete. Portal ${hub_id} connected.`);

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            status: 'installed',
            tenant_id: tenantId,
            hubspot_portal_id: hub_id,
            hubspot_label,
            expires_at,
            message: `HubSpot portal ${hub_id} successfully connected to Auro tenant ${tenantId} (${tenant.short_name}).`,
        }),
    };
};
