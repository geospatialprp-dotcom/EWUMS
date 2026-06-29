-- Manual VPS fix when migration 071 was not applied.
-- Run against production Postgres, then restart the API container.
-- Users do NOT need to re-login: PermissionsGuard reloads permissions from DB per request.

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id,
  CASE WHEN r.code = 'super_admin' THEN 'organization' ELSE 'division' END
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND p.resource = 'la_case'
  AND p.action IN ('read', 'create', 'update', 'approve')
  AND r.code IN ('super_admin', 'ee', 'se', 'ce', 'cgm', 'md', 'je', 'ae')
ON CONFLICT DO NOTHING;

-- Verify
SELECT r.code, p.resource || ':' || p.action AS permission, rp.scope
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE p.resource = 'la_case'
  AND r.code IN ('super_admin', 'ee', 'je', 'ae')
ORDER BY r.code, p.action;
