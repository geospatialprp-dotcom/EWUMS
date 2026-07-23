-- Contractor initiates O&M asset handover; JE → AE → EE review/approve.
-- JE/AE already hold om create/update for complaints; contractor needs create/update/submit.

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'division'
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND r.code = 'contractor'
  AND p.resource = 'om'
  AND p.action IN ('read', 'create', 'update', 'submit')
ON CONFLICT DO NOTHING;
