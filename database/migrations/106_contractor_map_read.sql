-- Contractor: Map Explorer read access (view registered GIS assets on map)
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000005', p.id, 'organization'
FROM permissions p
WHERE p.resource = 'layer' AND p.action = 'read'
ON CONFLICT DO NOTHING;
