
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTenant() {
    const { data, error } = await supabase.from('tenants').select('*').eq('id', 2).single();
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Tenant 2 Config:');
        console.log('- Short Name:', data.short_name);
        console.log('- Vapi Assistant ID:', data.vapi_assistant_id);
        console.log('- Vapi Phone Number ID:', data.vapi_phone_number_id);
        console.log('- Vapi API Key Set:', !!data.vapi_api_key);
        console.log('- CRM Type:', data.crm_type);
        console.log('- HubSpot Label:', data.hubspot_label);
    }
}

checkTenant();
