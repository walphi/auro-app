-- Migration: Point hubspot portal 147848927 to Christie's (tenant 3) instead of Eshel (tenant 2)

UPDATE public.hubspot_tokens
SET tenant_id = 3
WHERE tenant_id = 2 AND hubspot_portal_id = '147848927';
