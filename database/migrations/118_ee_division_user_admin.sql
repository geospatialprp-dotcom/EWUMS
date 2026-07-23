-- EE may administer users within their own division (add / update / deactivate).
-- Roles catalogue remains readable so the Users form can assign JE/AE/contractor roles.
-- Org-wide Roles admin UI stays HQ/super-admin only on the frontend.

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'division'
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND r.code = 'ee'
  AND p.resource = 'user'
  AND p.action IN ('read', 'create', 'update', 'delete')
ON CONFLICT DO NOTHING;

-- Division-scoped audit trail for EE Admin panel
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'division'
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND r.code = 'ee'
  AND p.resource = 'audit'
  AND p.action = 'read'
ON CONFLICT DO NOTHING;
