-- Secretariat Stage 8 — upload sanction documents + advance workflow actions
-- Run after 097 on existing VPS deployments.

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000030', p.id, 'organization'
FROM permissions p
WHERE p.resource = 'dpr_proposal' AND p.action = 'update'
ON CONFLICT DO NOTHING;
