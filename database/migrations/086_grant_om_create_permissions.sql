-- Consumer complaint registration requires om:create; workflow advance requires om:update.
-- Migration 027 granted om:create only to JE; EE had read+approve and AE had read+approve+update.
-- Field division staff and O&M operators need create/update for complaint intake and resolution.

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id,
  CASE WHEN r.code = 'super_admin' THEN 'organization' ELSE 'division' END
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND p.resource = 'om'
  AND p.action IN ('create', 'update')
  AND r.code IN ('super_admin', 'ee', 'je', 'ae', 'om_operator')
ON CONFLICT DO NOTHING;
