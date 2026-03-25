import axios from 'axios';
import { supabase } from './supabase';

/**
 * lib/hubspotAuth.ts — Auro HubSpot Authentication Helper
 *
 * Provides centralized token management (retrieval/refresh) for HubSpot.
 * Ensures tokens are always valid before calling the HubSpot API.
 */

const HS_TOKEN_URL = 'https://api.hubapi.com/oauth/v3/token';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5-minute buffer before expiry

export interface HubSpotTokenRow {
    tenant_id: number;
    hubspot_portal_id: number;
    hubspot_label: string;
    access_token: string;
    refresh_token: string;
    expires_at: string;
    scopes: string | null;
}

/**
 * Returns a valid HubSpot access token for the given tenant.
 * Silently refreshes if the token is within 5 minutes of expiry.
 */
export async function getHubSpotAccessTokenForTenant(tenantId: number): Promise<string> {
    const { data, error } = await supabase
        .from('hubspot_tokens')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

    if (error || !data) {
        throw new Error(
            `[HubSpotAuth] No HubSpot token found for tenant ${tenantId}. ` +
            `Complete the OAuth install flow first.`
        );
    }

    const row = data as HubSpotTokenRow;
    const expiresAt = new Date(row.expires_at).getTime();
    const now = Date.now();

    // If still valid (within buffer), return it
    if (expiresAt - now > TOKEN_REFRESH_BUFFER_MS) {
        return row.access_token;
    }

    // Token expired or about to expire — refresh
    console.log(`[tenant=${tenantId}|${row.hubspot_label}][HubSpotAuth] Access token expiring soon. Refreshing...`);
    return refreshHubSpotToken(tenantId, row.refresh_token, row.hubspot_label);
}

/**
 * Manually refresh a HubSpot access token using a refresh token.
 */
async function refreshHubSpotToken(
    tenantId: number,
    refreshToken: string,
    label: string
): Promise<string> {
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('[HubSpotAuth] Missing HUBSPOT_CLIENT_ID or HUBSPOT_CLIENT_SECRET env vars');
    }

    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
    });

    try {
        const resp = await axios.post(HS_TOKEN_URL, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const { access_token, refresh_token: new_refresh, expires_in } = resp.data;
        // HubSpot v3 returns expires_in in seconds. v1 was also seconds but the URL was different.
        const expires_at = new Date(Date.now() + (expires_in || 1800) * 1000).toISOString();

        const { error } = await supabase
            .from('hubspot_tokens')
            .update({ 
                access_token, 
                refresh_token: new_refresh || refreshToken, // Use old one if not rotated
                expires_at, 
                updated_at: new Date().toISOString() 
            })
            .eq('tenant_id', tenantId);

        if (error) {
            console.error(`[tenant=${tenantId}|${label}][HubSpotAuth] Failed to persist refreshed token:`, error.message);
        } else {
            console.log(`[tenant=${tenantId}|${label}][HubSpotAuth] Token refreshed. Expires at ${expires_at}`);
        }

        return access_token;
    } catch (err: any) {
        const detail = err.response?.data;
        console.error(`[tenant=${tenantId}|${label}][HubSpotAuth] Token refresh failed:`, detail || err.message);
        throw new Error(`HubSpot token refresh failed for tenant ${tenantId}: ${detail?.message || err.message}`);
    }
}
