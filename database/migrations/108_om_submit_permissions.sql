-- Stage 1 O&M handover submit requires permission om:submit.
-- Grant to field O&M roles used in demo flows.
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id,
  CASE WHEN r.code = 'super_admin' THEN 'organization' ELSE 'division' END
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND p.resource = 'om'
  AND p.action = 'submit'
  AND r.code IN ('super_admin', 'ee', 'je', 'ae', 'om_operator')
ON CONFLICT DO NOTHING;

