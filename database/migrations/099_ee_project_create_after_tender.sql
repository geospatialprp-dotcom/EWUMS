-- Division EE registers construction projects after tender publication (Project Management).
-- Reverses HQ-only project:create from 069; Super Admin remains view-only.

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'division'
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND r.code = 'ee'
  AND p.resource = 'project'
  AND p.action IN ('create', 'update')
ON CONFLICT DO NOTHING;

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND r.code IN ('se', 'ce', 'cgm', 'md')
  AND p.resource = 'project'
  AND p.action = 'create';
