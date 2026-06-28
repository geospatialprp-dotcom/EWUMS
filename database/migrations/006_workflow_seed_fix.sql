-- Seed workflow definitions and sample data (valid hex UUIDs)
INSERT INTO workflow_definitions (id, tenant_id, code, name, resource_type, description, steps) VALUES
('f1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
 'asset_create', 'Asset Creation Approval', 'asset',
 'New assets require GIS Administrator review before publishing to the map.',
 '[{"order":1,"name":"GIS Review","role":"gis_admin","action":"review"},{"order":2,"name":"Final Approval","role":"super_admin","action":"approve"}]'),
('f1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
 'layer_publish', 'Layer Publish Approval', 'layer',
 'GIS layers must be reviewed before publishing to production map services.',
 '[{"order":1,"name":"Technical Review","role":"gis_admin","action":"review"},{"order":2,"name":"Publish Approval","role":"super_admin","action":"approve"}]'),
('f1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
 'project_approve', 'Project Approval', 'project',
 'Capital projects require manager and executive approval.',
 '[{"order":1,"name":"Asset Manager Review","role":"asset_manager","action":"review"},{"order":2,"name":"Executive Approval","role":"super_admin","action":"approve"}]'),
('f1000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
 'user_provision', 'User Provisioning', 'user',
 'New user accounts require administrator approval.',
 '[{"order":1,"name":"Admin Approval","role":"super_admin","action":"approve"}]')
ON CONFLICT DO NOTHING;

INSERT INTO workflow_instances (id, tenant_id, definition_id, resource_type, resource_id, title, status, current_step, payload, submitted_by) VALUES
('f2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
 'f1000000-0000-0000-0000-000000000001', 'asset', NULL,
 'New Pipeline Segment PL-002 — Zone B Extension', 'pending', 1,
 '{"assetCode":"PL-002","name":"Zone B Extension Pipeline","assetType":"pipeline","status":"pending_approval"}',
 'c0000000-0000-0000-0000-000000000002'),
('f2000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
 'f1000000-0000-0000-0000-000000000003', 'project', 'f0000000-0000-0000-0000-000000000001',
 'Zone A Pipeline Rehabilitation — Budget Revision', 'pending', 1,
 '{"budgetChange":150000,"reason":"Additional valve replacements required"}',
 'c0000000-0000-0000-0000-000000000002'),
('f2000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
 'f1000000-0000-0000-0000-000000000002', 'layer', NULL,
 'Publish Consumer Connections Layer', 'pending', 1,
 '{"layerName":"Consumer Connections","sourceType":"geojson"}',
 'c0000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO workflow_tasks (instance_id, step_order, step_name, assigned_role, status)
SELECT i.id, 1,
  CASE i.definition_id
    WHEN 'f1000000-0000-0000-0000-000000000001' THEN 'GIS Review'
    WHEN 'f1000000-0000-0000-0000-000000000003' THEN 'Asset Manager Review'
    ELSE 'Technical Review'
  END,
  CASE i.definition_id
    WHEN 'f1000000-0000-0000-0000-000000000001' THEN 'gis_admin'
    WHEN 'f1000000-0000-0000-0000-000000000003' THEN 'asset_manager'
    ELSE 'gis_admin'
  END,
  'pending'
FROM workflow_instances i
WHERE i.id IN (
  'f2000000-0000-0000-0000-000000000001',
  'f2000000-0000-0000-0000-000000000002',
  'f2000000-0000-0000-0000-000000000003'
)
AND NOT EXISTS (
  SELECT 1 FROM workflow_tasks t WHERE t.instance_id = i.id AND t.status = 'pending'
);
