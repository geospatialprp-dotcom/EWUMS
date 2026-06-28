-- HQ-only construction project registration (reverses 068 division EE/JE create grant)

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id,
  CASE WHEN r.code = 'se' THEN 'circle' ELSE 'organization' END
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND r.code IN ('se', 'ce', 'cgm', 'md')
  AND p.resource = 'project'
  AND p.action = 'create'
ON CONFLICT DO NOTHING;

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND r.code IN ('ee', 'je', 'contractor')
  AND p.resource = 'project'
  AND p.action = 'create';
