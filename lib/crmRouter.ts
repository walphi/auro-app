/**
 * lib/crmRouter.ts — Auro CRM Routing Layer
 *
 * Routes generic CRM write actions to the correct backend based on
 * the tenant's crm_type field. v1 handles 'hubspot' only.
 *
 * IMPORTANT: bitrixClient.ts is NOT imported here.
 * Provident (tenant 1) never calls this router — it handles CRM writes
 * directly inside its own functions (provident-bitrix-webhook.ts, whatsapp.ts).
 *
 * Future crm_types (e.g. 'salesforce') can be added as new cases below.
 */

import * as hubspot from './hubspotClient';
import type { HubSpotContactProps } from './hubspotClient';

// ---------------------------------------------------------------------------
// Shared payload type
// ---------------------------------------------------------------------------

export interface CrmNotePayload {
    tenantId: number;
    phone: string;
    name: string;
    email?: string;
    noteText: string;
    qualificationData?: {
        status?: string;
        budget?: string;
        propertyType?: string;
        area?: string;
    };
    hsTimestamp?: string;
}

// ---------------------------------------------------------------------------
// Router actions
// ---------------------------------------------------------------------------

/**
 * Upsert a lead contact in the tenant's CRM and post a note.
 * Only handles 'hubspot' in v1.
 *
 * @returns contactId (HubSpot contact ID for this tenant)
 */
export async function syncLeadNote(
    crmType: string,
    payload: CrmNotePayload
): Promise<{ contactId: string; created: boolean }> {
    if (crmType === 'hubspot') {
        // Guard: never overwrite a real HubSpot name with a placeholder like "WhatsApp Lead +971..." or "Voice User 1234"
        const isPlaceholderName = !payload.name || /^(whatsapp lead|voice user)/i.test(payload.name.trim());
        const nameParts = isPlaceholderName ? [] : payload.name.trim().split(' ');
        const firstname = nameParts[0] || undefined;
        const lastname = nameParts.slice(1).join(' ') || undefined;

        const contactProps: HubSpotContactProps = {
            phone: payload.phone,
            // Only include name fields if we have a real name — prevents overwriting existing HubSpot names
            ...(firstname && { firstname }),
            ...(lastname && { lastname }),
            email: payload.email,
            // Note: Qualification data (budget, propertyType, area, status) is included in the 
            // note text itself (formatted in eshel-hubspot-crm-sync.ts), not as contact properties
            // to avoid 400 errors from missing custom properties in HubSpot
        };

        const { contactId, created } = await hubspot.upsertContact(payload.tenantId, contactProps);
        await hubspot.addContactNote(payload.tenantId, contactId, payload.noteText, payload.hsTimestamp);

        return { contactId, created };
    }

    // No Bitrix case — Provident handles its own CRM writes independently.
    const err = `[crmRouter] Unsupported crm_type: '${crmType}' for tenant ${payload.tenantId}`;
    console.error(err);
    throw new Error(err);
}

/**
 * Update contact properties only (no note). Useful for status changes.
 * Only handles 'hubspot' in v1.
 */
export async function updateLeadProperties(
    crmType: string,
    tenantId: number,
    contactId: string,
    props: Partial<HubSpotContactProps>
): Promise<void> {
    if (crmType === 'hubspot') {
        await hubspot.updateContact(tenantId, contactId, props);
        return;
    }

    const err = `[crmRouter] updateLeadProperties: Unsupported crm_type: '${crmType}' for tenant ${tenantId}`;
    console.error(err);
    throw new Error(err);
}
