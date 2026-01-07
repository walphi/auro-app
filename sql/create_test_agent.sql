-- Create a test agent and agentconfig for testing the build-site flow
-- Run this in Supabase SQL Editor

-- 1. Insert test agent (using gen_random_uuid for proper UUID)
INSERT INTO agents (id, phone, status, created_at)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
    '+971500000001',
    'onboarding',
    NOW()
)
ON CONFLICT (id) DO UPDATE SET status = 'onboarding';

-- 2. Insert test agentconfig
INSERT INTO agentconfigs (
    id,
    agent_id,
    slug,
    status,
    name,
    designation,
    company,
    phone,
    email,
    bio,
    primary_color,
    secondary_color,
    areas,
    listings,
    created_at,
    updated_at
)
VALUES (
    'b2c3d4e5-f6a7-8901-bcde-f12345678901'::uuid,
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
    'test-agent-2026',
    'draft',
    'Test Agent',
    'Senior Property Consultant',
    'Test Realty',
    '+971500000001',
    'test@auroapp.com',
    'This is a test agent for debugging the build-site flow.',
    '#1a365d',
    '#c9a227',
    ARRAY['Dubai Marina', 'JBR'],
    '[{"id": "lst_test1", "title": "Luxury Marina Apartment", "towerOrCommunity": "Marina Gate", "type": "sale", "price": 2500000, "currency": "AED", "beds": 2, "baths": 2, "sizeSqft": 1200, "features": ["Sea View", "Balcony"], "photos": ["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800"], "status": "available", "source": "manual", "createdAt": "2026-01-07T00:00:00Z", "updatedAt": "2026-01-07T00:00:00Z"}]'::jsonb,
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    status = 'draft',
    updated_at = NOW();

-- 3. Verify the insert
SELECT id, agent_id, slug, status, name FROM agentconfigs WHERE slug = 'test-agent-2026';

-- After running this, use this agentId to test:
-- a1b2c3d4-e5f6-7890-abcd-ef1234567890
