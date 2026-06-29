-- Complaint workflow advance (PATCH /om/complaints/:id/advance) requires om:update.
-- Migration 027 granted om:update to JE and AE only; EE had read+approve without update.
-- Field division staff need om:update at division scope to advance complaints through workflow.

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id,
  CASE WHEN r.code = 'super_admin' THEN 'organization' ELSE 'division' END
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND p.resource = 'om'
  AND p.action = 'update'
  AND r.code IN ('super_admin', 'ee', 'je', 'ae', 'om_operator')
ON CONFLICT DO NOTHING;

-- Verify after apply:
-- SELECT r.code, p.resource || ':' || p.action AS permission, rp.scope
-- FROM role_permissions rp
-- JOIN roles r ON r.id = rp.role_id
-- JOIN permissions p ON p.id = rp.permission_id
-- WHERE p.resource = 'om' AND p.action = 'update'
--   AND r.code IN ('super_admin', 'ee', 'je', 'ae', 'om_operator')
-- ORDER BY r.code;
