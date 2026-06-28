-- Fix LA permissions grant (070 used role name instead of code)
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'organization'
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND p.resource = 'la_case'
  AND r.code IN ('super_admin', 'ee', 'se', 'ce', 'cgm', 'md', 'je', 'ae')
ON CONFLICT DO NOTHING;
