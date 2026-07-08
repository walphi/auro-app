-- Migration: Add Christie's Dubai demo tenant (ID 3)

INSERT INTO public.tenants (
    id,
    name,
    short_name,
    twilio_phone_number,
    twilio_whatsapp_number,
    crm_type,
    rag_client_id,
    system_prompt_identity
) VALUES (
    3,
    'Christie’s International Real Estate Dubai',
    'christies_dubai',
    '+12098994972',
    '+12098994972',
    'hubspot',
    'christies_dubai',
    'Christie’s International Real Estate Dubai'
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    short_name = EXCLUDED.short_name,
    twilio_phone_number = EXCLUDED.twilio_phone_number,
    twilio_whatsapp_number = EXCLUDED.twilio_whatsapp_number,
    crm_type = EXCLUDED.crm_type,
    rag_client_id = EXCLUDED.rag_client_id,
    system_prompt_identity = EXCLUDED.system_prompt_identity;

-- Remove the demo whatsapp number from Provident (if it is there)
UPDATE public.tenants
SET twilio_whatsapp_number = '+971565203832'
WHERE id = 1 AND twilio_whatsapp_number = '+12098994972';
