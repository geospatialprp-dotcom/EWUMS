-- Executive Dashboard: grant dashboard:read to division engineering staff and super_admin.
-- HQ roles (md, cgm, ce, se) already receive dashboard:read via 047_ujs_rbac_governance_framework.sql.

INSERT INTO permissions (resource, action, description) VALUES
('dashboard', 'read', 'View dashboards')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id,
  CASE WHEN r.code = 'super_admin' THEN 'organization' ELSE 'division' END
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND p.resource = 'dashboard'
  AND p.action = 'read'
  AND r.code IN ('super_admin', 'ee', 'je', 'ae')
ON CONFLICT DO NOTHING;
