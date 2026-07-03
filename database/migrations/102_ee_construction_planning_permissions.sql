-- Work Planning: EE and HQ engineering roles need construction:create + construction:update
-- (BOQ import, work packages, document uploads, save planning).
-- Without this, EE sees "Missing required permission: construction:create".

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id,
  CASE WHEN r.code IN ('md', 'cgm', 'ce') THEN 'organization' ELSE 'division' END
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND p.resource = 'construction'
  AND p.action IN ('create', 'update')
  AND r.code IN ('ee', 'se', 'ce', 'cgm', 'md')
ON CONFLICT DO NOTHING;

-- Belt-and-suspenders: fixed EE role id from migration 012
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000008', p.id, 'division'
FROM permissions p
WHERE p.resource = 'construction'
  AND p.action IN ('create', 'update')
ON CONFLICT DO NOTHING;
