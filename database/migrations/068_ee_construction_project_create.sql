-- Division EE/JE can create construction projects after tender is published (Project Management)

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'division'
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND r.code IN ('ee', 'je')
  AND p.resource = 'project'
  AND p.action IN ('create', 'update')
ON CONFLICT DO NOTHING;
