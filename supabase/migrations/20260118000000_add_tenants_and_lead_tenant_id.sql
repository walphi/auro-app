-- Create the tenants table to store configuration for each developer/broker.
CREATE TABLE IF NOT EXISTS public.tenants (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL UNIQUE,
    twilio_account_sid TEXT,
    twilio_auth_token TEXT,
    twilio_phone_number TEXT UNIQUE,
    vapi_phone_number_id TEXT,
    vapi_assistant_id TEXT,
    vapi_api_key TEXT,
    crm_type TEXT DEFAULT 'bitrix',
    crm_webhook_url TEXT,
    rag_client_id TEXT,
    system_prompt_identity TEXT,
    booking_cal_link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add tenant_id to leads for data isolation
-- We will default this to 1 for existing leads after seeding Provident
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES public.tenants(id);

-- Seed Provident as id = 1 for backward compatibility
INSERT INTO public.tenants (
    id,
    name,
    short_name,
    twilio_account_sid,
    twilio_auth_token,
    twilio_phone_number,
    vapi_phone_number_id,
    vapi_assistant_id,
    vapi_api_key,
    crm_type,
    crm_webhook_url,
    rag_client_id,
    system_prompt_identity,
    booking_cal_link
) VALUES (
    1,
    'Provident Real Estate',
    'provident',
    'AC9aa932cbab62a7e9a8d1ec5754a6a604', -- From .env.local
    'e596ce35f74849e38f9061c7703282af', -- From .env.local
    'whatsapp:+14155238886', -- Standard Sandbox number
    '66dcc4a6-44cb-4a3e-8166-faf5aa349016', -- VAPI_PHONE_NUMBER from .env.local
    'f4162cdd-c424-4849-82ad-7c8abff3f929', -- VAPI_ASSISTANT_ID from .env.local
    '0bbf9a3a-30b8-4d57-9df7-dcccfbf5d6b5', -- VAPI_API_KEY from .env.local
    'bitrix',
    NULL, -- TODO: Update with real BITRIX_WEBHOOK_URL
    'demo',
    'Provident Real Estate',
    'https://cal.com/provident-real-estate/viewing'
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    short_name = EXCLUDED.short_name,
    twilio_account_sid = EXCLUDED.twilio_account_sid,
    twilio_auth_token = EXCLUDED.twilio_auth_token,
    twilio_phone_number = EXCLUDED.twilio_phone_number,
    vapi_phone_number_id = EXCLUDED.vapi_phone_number_id,
    vapi_assistant_id = EXCLUDED.vapi_assistant_id,
    vapi_api_key = EXCLUDED.vapi_api_key,
    rag_client_id = EXCLUDED.rag_client_id,
    system_prompt_identity = EXCLUDED.system_prompt_identity;

-- Set existing leads to tenant_id = 1
UPDATE public.leads SET tenant_id = 1 WHERE tenant_id IS NULL;
