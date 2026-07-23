-- Manual VPS grant: EE division user admin (add/remove staff in own division)
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'division'
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND r.code = 'ee'
  AND (
    (p.resource = 'user' AND p.action IN ('read', 'create', 'update', 'delete'))
    OR (p.resource = 'audit' AND p.action = 'read')
  )
ON CONFLICT DO NOTHING;

SELECT r.code, p.resource || ':' || p.action AS permission, rp.scope
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE r.code = 'ee' AND p.resource IN ('user', 'audit')
ORDER BY p.resource, p.action;
