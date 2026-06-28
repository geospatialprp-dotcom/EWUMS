-- Division field staff: create/import/edit GIS layers within their authorized schemes
-- (EE/AE/JE and GIS operators — not statewide project creation)

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'division'
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('je', 'ae', 'ee', 'gis_operator', 'data_entry_operator')
  AND p.resource = 'layer'
  AND p.action IN ('create', 'update', 'delete')
ON CONFLICT DO NOTHING;
