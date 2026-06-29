-- VPS one-liner (run inside postgres container):
-- docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres psql -U egip -d egip -f - < database/scripts/fix-dpr-hq-review-super-admin-vps.sql

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'organization'
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND r.code = 'super_admin'
  AND p.resource = 'dpr_proposal'
  AND p.action = 'approve'
ON CONFLICT DO NOTHING;

-- Verify:
SELECT r.code, p.resource || ':' || p.action AS permission, rp.scope
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE r.code = 'super_admin' AND p.resource = 'dpr_proposal'
ORDER BY p.action;
