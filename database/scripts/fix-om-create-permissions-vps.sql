-- Manual VPS fix when migration 086 was not applied.
-- Run against production Postgres, then restart the API container.
-- Users do NOT need to re-login: PermissionsGuard reloads permissions from DB per request.

-- Grant om:create + om:update to field roles (idempotent)
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id,
  CASE WHEN r.code = 'super_admin' THEN 'organization' ELSE 'division' END
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND p.resource = 'om'
  AND p.action IN ('create', 'update')
  AND r.code IN ('super_admin', 'ee', 'je', 'ae', 'om_operator')
ON CONFLICT DO NOTHING;

-- EE-only quick grant (Karanprayag demo user ee.kpg@egip.local)
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000008', p.id, 'division'
FROM permissions p
WHERE p.resource = 'om' AND p.action IN ('create', 'update')
ON CONFLICT DO NOTHING;

-- Verify
SELECT r.code, p.resource || ':' || p.action AS permission, rp.scope
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE p.resource = 'om' AND p.action IN ('create', 'update')
  AND r.code IN ('super_admin', 'ee', 'je', 'ae', 'om_operator')
ORDER BY r.code, p.action;
