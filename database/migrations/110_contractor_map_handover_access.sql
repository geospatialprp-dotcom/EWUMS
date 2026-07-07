-- Contractor demo access: Map Explorer + O&M handover initiation.

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000005', p.id, 'organization'
FROM permissions p
WHERE p.resource = 'layer' AND p.action = 'read'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000005', p.id, 'organization'
FROM permissions p
WHERE p.resource IN ('project', 'construction')
  AND p.action IN ('read', 'create', 'update', 'submit')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000005', p.id, 'division'
FROM permissions p
WHERE p.resource = 'om'
  AND p.action IN ('read', 'create', 'update', 'submit')
ON CONFLICT DO NOTHING;
