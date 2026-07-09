-- JE inbox + O&M handover approval repair (Tharali demo).

-- JE must approve handover workflow steps (Workflow Center + O&M page).
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000006', p.id, 'division'
FROM permissions p
WHERE p.resource = 'om' AND p.action = 'approve'
ON CONFLICT DO NOTHING;

-- Re-affirm Karanprayag demo team division assignments (empty scope = inbox filtered to 0).
UPDATE users
SET division_id = 'd1000000-0000-0000-0000-000000000010',
    updated_at = NOW()
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND email IN ('je.kpg@egip.local', 'ae.kpg@egip.local', 'ee.kpg@egip.local');

INSERT INTO user_division_assignments (user_id, division_id) VALUES
('c0000000-0000-0000-0000-000000000011', 'd1000000-0000-0000-0000-000000000010'),
('c0000000-0000-0000-0000-000000000012', 'd1000000-0000-0000-0000-000000000010'),
('c0000000-0000-0000-0000-000000000010', 'd1000000-0000-0000-0000-000000000010')
ON CONFLICT (user_id) DO UPDATE SET division_id = EXCLUDED.division_id;

-- Tharali project division (belt-and-suspenders).
UPDATE projects
SET division_id = 'd1000000-0000-0000-0000-000000000010',
    updated_at = NOW()
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND (
    project_code IN ('PRJ-TPPWSS-2026-27', 'PRJ-2026-001')
    OR name ILIKE '%Tharali%'
  );

-- Pending om_handover workflow payloads carry division for notifications.
UPDATE workflow_instances wi
SET payload = COALESCE(wi.payload, '{}'::jsonb) || jsonb_build_object(
      'divisionId', 'd1000000-0000-0000-0000-000000000010'
    )
FROM om_handover h
WHERE wi.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND wi.resource_type = 'om_handover'
  AND wi.status = 'pending'
  AND h.id = wi.resource_id
  AND (
    h.scheme_name ILIKE '%Tharali%'
    OR h.project_id IN (
      SELECT id FROM projects
      WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
        AND (project_code IN ('PRJ-TPPWSS-2026-27', 'PRJ-2026-001') OR name ILIKE '%Tharali%')
    )
  );

-- Recreate missing pending tasks (e.g. submit succeeded but task row missing).
INSERT INTO workflow_tasks (instance_id, step_order, step_name, assigned_role, status)
SELECT wi.id,
       (step->>'order')::int,
       step->>'name',
       step->>'role',
       'pending'
FROM workflow_instances wi
JOIN workflow_definitions wd ON wd.id = wi.definition_id
CROSS JOIN LATERAL jsonb_array_elements(wd.steps) AS step
WHERE wi.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND wi.resource_type = 'om_handover'
  AND wi.status = 'pending'
  AND wd.code = 'om_handover'
  AND (step->>'order')::int = wi.current_step
  AND NOT EXISTS (
    SELECT 1 FROM workflow_tasks wt
    WHERE wt.instance_id = wi.id AND wt.status = 'pending'
  );

-- Align handover status with workflow step (EE step was mis-labelled handed_over).
UPDATE om_handover h
SET status = CASE wi.current_step
      WHEN 1 THEN 'je_review'
      WHEN 2 THEN 'ae_review'
      WHEN 3 THEN 'ee_review'
      ELSE h.status
    END,
    updated_at = NOW()
FROM workflow_instances wi
WHERE h.workflow_instance_id = wi.id
  AND wi.status = 'pending'
  AND wi.resource_type = 'om_handover'
  AND h.tenant_id = 'a0000000-0000-0000-0000-000000000001';

-- Contractor uploads should not show "awaiting dept approval" before handover submit.
UPDATE om_handover_documents d
SET status = 'uploaded'
FROM om_handover h
WHERE d.handover_id = h.id
  AND h.status IN ('draft', 'rejected')
  AND d.status = 'submitted'
  AND d.source = 'upload';
