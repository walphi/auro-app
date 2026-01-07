-- Reset phillip-walsh agent to PREVIEW_SUMMARY
UPDATE site_conversations
SET current_state = 'PREVIEW_SUMMARY',
    last_message_at = NOW()
WHERE agent_id = '1efaba76-6493-4154-b4e1-5b7a420cf584';

-- Reset config to draft so they can approve again
UPDATE agentconfigs
SET status = 'draft',
    updated_at = NOW(),
    needs_site_rebuild = false
WHERE agent_id = '1efaba76-6493-4154-b4e1-5b7a420cf584';
