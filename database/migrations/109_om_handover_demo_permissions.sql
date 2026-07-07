-- Handover submit + contractor-only O&M handover initiation (Stage 1).

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id,
  CASE WHEN r.code = 'super_admin' THEN 'organization' ELSE 'division' END
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND p.resource = 'om'
  AND p.action IN ('read', 'create', 'update', 'submit')
  AND r.code = 'contractor'
ON CONFLICT DO NOTHING;

-- Belt-and-suspenders: ensure field roles retain om:submit at division scope.
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id,
  CASE WHEN r.code = 'super_admin' THEN 'organization' ELSE 'division' END
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND p.resource = 'om'
  AND p.action = 'submit'
  AND r.code IN ('super_admin', 'ee', 'je', 'ae', 'om_operator', 'contractor')
ON CONFLICT DO NOTHING;
