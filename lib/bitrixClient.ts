import axios from 'axios';

/**
 * Bitrix24 REST API Client
 * 
 * This client handles interaction with Provident Real Estate's Bitrix24 CRM.
 * It uses the BITRIX_WEBHOOK_URL environment variable.
 */

export interface BitrixLead {
    id: string;
    TITLE: string;
    NAME?: string;
    LAST_NAME?: string;
    PHONE?: Array<{ VALUE: string; VALUE_TYPE: string }>;
    EMAIL?: Array<{ VALUE: string; VALUE_TYPE: string }>;
    ASSIGNED_BY_ID?: string;
    [key: string]: any;
}

export interface BitrixDeal {
    id: string;
    TITLE: string;
    [key: string]: any;
}

/**
 * Fetches full lead details from Bitrix24
 * @param leadId The ID of the lead to fetch
 * @param customWebhookUrl Optional specific webhook URL for multi-tenancy
 * @returns Promise with lead data
 */
export async function getLeadById(leadId: string, customWebhookUrl?: string): Promise<BitrixLead> {
    const webhookUrl = customWebhookUrl || process.env.BITRIX_WEBHOOK_URL || process.env.BITRIX_PROVIENDENT_WEBHOOK_URL;
    if (!webhookUrl) {
        throw new Error('Bitrix Webhook URL is not defined (checked argument and BITRIX_WEBHOOK_URL / BITRIX_PROVIENDENT_WEBHOOK_URL env)');
    }

    console.log(`[BitrixClient] Fetching lead ${leadId} from Bitrix24 using ${webhookUrl.substring(0, 30)}...`);

    try {
        const response = await axios.get(`${webhookUrl}/crm.lead.get.json`, {
            params: { ID: leadId }
        });

        if (response.data.error) {
            console.error(`[BitrixClient] Bitrix API Error: ${response.data.error_description || response.data.error}`);
            throw new Error(`Bitrix API Error: ${response.data.error}`);
        }

        return response.data.result;
    } catch (error: any) {
        console.error(`[BitrixClient] Failed to fetch lead ${leadId}:`, error.message);
        if (error.response?.data) {
            console.error(`[BitrixClient] Error details:`, JSON.stringify(error.response.data));
        }
        throw error;
    }
}

/**
 * Updates lead fields in Bitrix24
 * @param leadId The ID of the lead to update
 * @param fields Object containing fields to update
 * @param customWebhookUrl Optional specific webhook URL for multi-tenancy
 */
export async function updateLead(leadId: string, fields: Record<string, any>, customWebhookUrl?: string): Promise<void> {
    const webhookUrl = customWebhookUrl || process.env.BITRIX_WEBHOOK_URL || process.env.BITRIX_PROVIENDENT_WEBHOOK_URL;
    if (!webhookUrl) {
        throw new Error('Bitrix Webhook URL is not defined (checked argument and BITRIX_WEBHOOK_URL / BITRIX_PROVIENDENT_WEBHOOK_URL env)');
    }

    console.log(`[BitrixClient] Updating lead ${leadId} in Bitrix24 using ${webhookUrl.substring(0, 30)}...`);

    try {
        const response = await axios.post(`${webhookUrl}/crm.lead.update.json`, {
            id: leadId,
            fields: fields
        });

        if (response.data.error) {
            console.error(`[BitrixClient] Bitrix API Error during update: ${response.data.error_description || response.data.error}`);
            throw new Error(`Bitrix API Error: ${response.data.error}`);
        }

        console.log(`[BitrixClient] Lead ${leadId} updated successfully`);
    } catch (error: any) {
        console.error(`[BitrixClient] Failed to update lead ${leadId}:`, error.message);
        if (error.response?.data) {
            console.error(`[BitrixClient] Error details:`, JSON.stringify(error.response.data));
        }
        throw error;
    }
}

/**
 * Adds a comment to the lead's timeline in Bitrix24
 * @param entityId The ID of the lead
 * @param comment The comment text to add
 * @returns Promise with the API response data
 */
export async function addLeadComment(entityId: string, comment: string) {
    const baseUrl = process.env.BITRIX_WEBHOOK_URL || process.env.BITRIX_PROVIENDENT_WEBHOOK_URL;
    if (!baseUrl) {
        throw new Error('Bitrix Webhook URL is not defined');
    }

    const url = `${baseUrl}/crm.timeline.comment.add.json`;

    const body = {
        fields: {
            ENTITY_ID: entityId,
            ENTITY_TYPE: 'lead',
            COMMENT: comment,
            AUTHOR_ID: 1
        }
    };

    try {
        const response = await axios.post(url, body);
        console.log('[BitrixClient] Add comment response:', response.data);
        return response.data;
    } catch (error: any) {
        console.error(`[BitrixClient] Failed to add comment to lead ${entityId}:`, error.message);
        if (error.response?.data) {
            console.error(`[BitrixClient] Error details:`, JSON.stringify(error.response.data));
        }
        throw error;
    }
}
/**
 * Fetches full deal details from Bitrix24
 * @param dealId The ID of the deal to fetch
 * @returns Promise with deal data
 */
export async function getDealById(dealId: string | number): Promise<any> {
    const webhookUrl = process.env.BITRIX_PROVIDENT_WEBHOOK_URL;
    if (!webhookUrl) {
        throw new Error('BITRIX_PROVIDENT_WEBHOOK_URL is not defined');
    }

    console.log(`[BitrixClient] Fetching deal ${dealId} from Bitrix24...`);

    try {
        const response = await axios.get(`${webhookUrl}/crm.deal.get.json`, {
            params: { ID: dealId }
        });

        if (response.data.error) {
            console.error(`[BitrixClient] Bitrix API Error: ${response.data.error_description || response.data.error}`);
            throw new Error(`Bitrix API Error: ${response.data.error}`);
        }

        return response.data.result;
    } catch (error: any) {
        console.error(`[BitrixClient] Failed to fetch deal ${dealId}:`, error.message);
        throw error;
    }
}

/**
 * Adds a comment to the deal's timeline in Bitrix24
 * @param dealId The ID of the deal
 * @param comment The comment text to add
 */
export async function addDealComment(dealId: string | number, comment: string) {
    const webhookUrl = process.env.BITRIX_PROVIDENT_WEBHOOK_URL;
    if (!webhookUrl) {
        throw new Error('BITRIX_PROVIDENT_WEBHOOK_URL is not defined');
    }

    const url = `${webhookUrl}/crm.timeline.comment.add.json`;

    const body = {
        fields: {
            ENTITY_ID: dealId,
            ENTITY_TYPE: 'deal',
            COMMENT: comment,
            AUTHOR_ID: 1
        }
    };

    try {
        const response = await axios.post(url, body);
        console.log('[BitrixClient] Add deal comment response:', response.data);
        return response.data;
    } catch (error: any) {
        console.error(`[BitrixClient] Failed to add comment to deal ${dealId}:`, error.message);
        throw error;
    }
}
