import axios from 'axios';
import { supabase } from './supabase';

/**
 * HubSpot CRM v3 Client — Auro
 *
 * Handles contacts and notes (engagements) for HubSpot-integrated tenants.
 * Does NOT manage deals or pipelines (out of scope for v1).
 * Token refresh is transparent: every exported function calls getAccessToken()
 * which silently refreshes when expiry is within 5 minutes.
 *
 * Logging convention: [tenant=<id>|<label>][HubSpotClient] ...
 */

const HS_API = 'https://api.hubapi.com';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5-minute buffer before expiry

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HubSpotContactProps {
    phone: string;
    firstname?: string;
    lastname?: string;
    email?: string;
    hs_lead_status?: string;
    budget_range?: string;       // custom property — must be created in Eshel's HubSpot portal
    property_type?: string;      // custom property
    preferred_area?: string;     // custom property
    [key: string]: string | undefined;
}

interface HubSpotTokenRow {
    tenant_id: number;
    hubspot_portal_id: number;
    hubspot_label: string;
    access_token: string;
    refresh_token: string;
    expires_at: string;
    scopes: string | null;
}

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

/**
 * Returns a valid access token for the given tenant.
 * Silently refreshes if the token is within 5 minutes of expiry.
 */
export async function getAccessToken(tenantId: number): Promise<string> {
    const { data, error } = await supabase
        .from('hubspot_tokens')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

    if (error || !data) {
        throw new Error(
            `[HubSpotClient] No HubSpot token found for tenant ${tenantId}. ` +
            `Complete the OAuth install flow first.`
        );
    }

    const row = data as HubSpotTokenRow;
    const expiresAt = new Date(row.expires_at).getTime();
    const now = Date.now();

    if (expiresAt - now > TOKEN_REFRESH_BUFFER_MS) {
        return row.access_token;
    }

    // Token expired or about to expire — refresh
    console.log(`[tenant=${tenantId}|${row.hubspot_label}][HubSpotClient] Access token expiring soon. Refreshing...`);
    return refreshAccessToken(tenantId, row.refresh_token, row.hubspot_label);
}

async function refreshAccessToken(
    tenantId: number,
    refreshToken: string,
    label: string
): Promise<string> {
    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.HUBSPOT_CLIENT_ID || '',
        client_secret: process.env.HUBSPOT_CLIENT_SECRET || '',
        refresh_token: refreshToken,
    });

    try {
        const resp = await axios.post(`${HS_API}/oauth/v1/token`, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const { access_token, refresh_token: new_refresh, expires_in } = resp.data;
        const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

        const { error } = await supabase
            .from('hubspot_tokens')
            .update({ access_token, refresh_token: new_refresh, expires_at, updated_at: new Date().toISOString() })
            .eq('tenant_id', tenantId);

        if (error) {
            console.error(`[tenant=${tenantId}|${label}][HubSpotClient] Failed to persist refreshed token:`, error.message);
        } else {
            console.log(`[tenant=${tenantId}|${label}][HubSpotClient] Token refreshed. Expires at ${expires_at}`);
        }

        return access_token;
    } catch (err: any) {
        const detail = err.response?.data;
        console.error(`[tenant=${tenantId}|${label}][HubSpotClient] Token refresh failed:`, detail || err.message);
        throw new Error(`HubSpot token refresh failed for tenant ${tenantId}: ${detail?.message || err.message}`);
    }
}

// ---------------------------------------------------------------------------
// Contact search
// ---------------------------------------------------------------------------

/**
 * Search for a contact by phone number (primary dedup key).
 * Returns the HubSpot contact ID string, or null if not found.
 */
export async function findContactByPhone(tenantId: number, phone: string): Promise<string | null> {
    const token = await getAccessToken(tenantId);

    try {
        const resp = await axios.post(
            `${HS_API}/crm/v3/objects/contacts/search`,
            {
                filterGroups: [{
                    filters: [{ propertyName: 'phone', operator: 'EQ', value: phone }]
                }],
                properties: ['id', 'phone', 'email', 'firstname', 'lastname'],
                limit: 1,
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const results = resp.data.results ?? [];
        return results.length > 0 ? results[0].id : null;
    } catch (err: any) {
        console.error(`[tenant=${tenantId}][HubSpotClient] findContactByPhone error:`, err.response?.data || err.message);
        return null;
    }
}

/**
 * Search for a contact by email address (secondary dedup key).
 * Returns the HubSpot contact ID string, or null if not found.
 */
export async function findContactByEmail(tenantId: number, email: string): Promise<string | null> {
    const token = await getAccessToken(tenantId);

    try {
        const resp = await axios.post(
            `${HS_API}/crm/v3/objects/contacts/search`,
            {
                filterGroups: [{
                    filters: [{ propertyName: 'email', operator: 'EQ', value: email }]
                }],
                properties: ['id', 'phone', 'email', 'firstname', 'lastname'],
                limit: 1,
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const results = resp.data.results ?? [];
        return results.length > 0 ? results[0].id : null;
    } catch (err: any) {
        console.error(`[tenant=${tenantId}][HubSpotClient] findContactByEmail error:`, err.response?.data || err.message);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Contact CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new HubSpot contact. Returns the new contact's ID.
 */
export async function createContact(tenantId: number, props: HubSpotContactProps): Promise<string> {
    const token = await getAccessToken(tenantId);

    // Strip undefined values before sending
    const properties = Object.fromEntries(
        Object.entries(props).filter(([, v]) => v !== undefined && v !== '')
    );

    const resp = await axios.post(
        `${HS_API}/crm/v3/objects/contacts`,
        { properties },
        { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log(`[tenant=${tenantId}][HubSpotClient] Created contact ${resp.data.id} for phone ${props.phone}`);
    return resp.data.id;
}

/**
 * Update properties on an existing contact.
 */
export async function updateContact(
    tenantId: number,
    contactId: string,
    props: Partial<HubSpotContactProps>
): Promise<void> {
    const token = await getAccessToken(tenantId);

    const properties = Object.fromEntries(
        Object.entries(props).filter(([, v]) => v !== undefined && v !== '')
    );

    await axios.patch(
        `${HS_API}/crm/v3/objects/contacts/${contactId}`,
        { properties },
        { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log(`[tenant=${tenantId}][HubSpotClient] Updated contact ${contactId}`);
}

/**
 * Full upsert with phone-first, email-second deduplication.
 * Returns { contactId, created }.
 */
export async function upsertContact(
    tenantId: number,
    props: HubSpotContactProps
): Promise<{ contactId: string; created: boolean }> {
    let contactId: string | null = null;

    // 1. Phone lookup (primary)
    if (props.phone) {
        contactId = await findContactByPhone(tenantId, props.phone);
    }

    // 2. Email lookup (secondary)
    if (!contactId && props.email) {
        contactId = await findContactByEmail(tenantId, props.email);
    }

    // 3. Create if still not found
    if (!contactId) {
        contactId = await createContact(tenantId, props);
        return { contactId, created: true };
    }

    // 4. Update existing
    await updateContact(tenantId, contactId, props);
    return { contactId, created: false };
}

// ---------------------------------------------------------------------------
// Notes (Engagements)
// ---------------------------------------------------------------------------

/**
 * Post a Note visible on a contact's timeline.
 * Mirrors addLeadComment / addDealComment in bitrixClient.ts.
 *
 * @param tenantId   Auro tenant ID
 * @param contactId  HubSpot contact ID to associate the note with
 * @param noteBody   Plain-text note content
 */
export async function addContactNote(
    tenantId: number,
    contactId: string,
    noteBody: string,
    hsTimestamp?: string
): Promise<void> {
    const token = await getAccessToken(tenantId);

    // HubSpot Notes API: create the note object
    const noteResp = await axios.post(
        `${HS_API}/crm/v3/objects/notes`,
        {
            properties: {
                hs_note_body: noteBody,
                hs_timestamp: hsTimestamp || new Date().toISOString(),
            },
        },
        { headers: { Authorization: `Bearer ${token}` } }
    );

    const noteId = noteResp.data.id;

    // Associate note → contact
    await axios.put(
        `${HS_API}/crm/v3/objects/notes/${noteId}/associations/contacts/${contactId}/note_to_contact`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log(`[tenant=${tenantId}][HubSpotClient] Note ${noteId} posted to contact ${contactId}`);
}
