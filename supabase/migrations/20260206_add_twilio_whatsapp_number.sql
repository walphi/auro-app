-- Migration: Add twilio_whatsapp_number and wiring Provident to UAE number

-- 1. Add twilio_whatsapp_number column to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS twilio_whatsapp_number TEXT;

-- 2. Update Provident (ID 1) to use the new UAE WhatsApp number
-- Also ensuring twilio_messaging_service_sid references correct service if needed (skipping service sid update for now unless user provided it, but setting the number is key)
UPDATE tenants 
SET twilio_whatsapp_number = '+971565203832'
WHERE id = 1;

-- 3. Update comments/docs
COMMENT ON COLUMN tenants.twilio_whatsapp_number IS 'Dedicated WhatsApp sender number (E.164) if different from primary voice number';

-- 4. Just in case, ensure the legacy twilio_phone_number remains valid for voice or fallback, but WhatsApp will prefer the new column.
