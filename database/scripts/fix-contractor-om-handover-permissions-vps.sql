-- Manual VPS grant when migration 117 is not yet applied.
-- Contractor initiates O&M handover; JE/AE/EE review.

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'division'
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND r.code = 'contractor'
  AND p.resource = 'om'
  AND p.action IN ('read', 'create', 'update', 'submit')
ON CONFLICT DO NOTHING;

SELECT r.code, p.resource || ':' || p.action AS permission
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE r.code = 'contractor' AND p.resource = 'om'
ORDER BY p.action;
