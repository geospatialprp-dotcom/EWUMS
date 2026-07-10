-- SCADA operators ingest telemetry via POST /om/scada/readings (requires om:create).
-- Migration 047 granted scada_operator read+update on scada,om,project only.

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000020', p.id, 'division'
FROM permissions p
WHERE p.resource = 'om' AND p.action = 'create'
ON CONFLICT DO NOTHING;
