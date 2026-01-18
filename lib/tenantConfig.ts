import { supabase } from './supabase';

export interface Tenant {
    id: number;
    name: string;
    short_name: string;
    twilio_account_sid: string;
    twilio_auth_token: string;
    twilio_phone_number: string;
    vapi_phone_number_id: string;
    vapi_assistant_id: string;
    vapi_api_key: string;
    crm_type: string;
    crm_webhook_url: string;
    rag_client_id: string;
    system_prompt_identity: string;
    booking_cal_link: string;
    created_at: string;
}

/**
 * Fetches tenant configuration by Twilio phone number (To number)
 */
export async function getTenantByTwilioNumber(phone: string): Promise<Tenant | null> {
    console.log(`[TenantConfig] Resolving tenant for Twilio number: ${phone}`);

    // Normalize phone number (ensure 'whatsapp:' prefix if needed, or handle both)
    const normalizedPhone = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;

    const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('twilio_phone_number', normalizedPhone)
        .single();

    if (error) {
        console.warn(`[TenantConfig] Error fetching tenant by phone ${phone}:`, error.message);
        return null;
    }

    if (data) {
        console.log(`[TenantConfig] Resolved tenant ${data.short_name} (id=${data.id})`);
    }

    return data as Tenant;
}

/**
 * Fetches tenant configuration by VAPI Assistant ID
 */
export async function getTenantByVapiId(vapiAssistantId: string): Promise<Tenant | null> {
    console.log(`[TenantConfig] Resolving tenant for VAPI Assistant ID: ${vapiAssistantId}`);

    const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('vapi_assistant_id', vapiAssistantId)
        .single();

    if (error) {
        console.warn(`[TenantConfig] Error fetching tenant by VAPI ID ${vapiAssistantId}:`, error.message);
        return null;
    }

    if (data) {
        console.log(`[TenantConfig] Resolved tenant ${data.short_name} (id=${data.id})`);
    }

    return data as Tenant;
}

/**
 * Fetches tenant configuration by ID
 */
export async function getTenantById(id: number): Promise<Tenant | null> {
    console.log(`[TenantConfig] Resolving tenant for ID: ${id}`);

    const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.warn(`[TenantConfig] Error fetching tenant by ID ${id}:`, error.message);
        return null;
    }

    return data as Tenant;
}

/**
 * Helper to get default tenant (Provident) for fallback
 */
export async function getDefaultTenant(): Promise<Tenant> {
    const tenant = await getTenantById(1);
    if (!tenant) {
        throw new Error("Default tenant (ID=1) not found in database.");
    }
    return tenant;
}
