-- Division EEs must not have statewide access; only HQ assignment or state roles see all divisions.

DELETE FROM role_permissions
WHERE role_id = 'b0000000-0000-0000-0000-000000000008'
  AND permission_id IN (
    SELECT id FROM permissions WHERE resource = 'division' AND action = 'view_all'
  );

-- Karanprayag EE demo (division-scoped — sees only Karanprayag schemes)
INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, department, status, division_id)
VALUES (
  'c0000000-0000-0000-0000-000000000010',
  'a0000000-0000-0000-0000-000000000001',
  'ee.kpg@egip.local',
  crypt('EE@123', gen_salt('bf')),
  'Executive',
  'Engineer (KPG)',
  'Karanprayag Division',
  'active',
  'd1000000-0000-0000-0000-000000000010'
)
ON CONFLICT (tenant_id, email) DO UPDATE SET
  division_id = EXCLUDED.division_id,
  department = EXCLUDED.department,
  status = 'active';

INSERT INTO user_roles (user_id, role_id)
VALUES ('c0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000008')
ON CONFLICT DO NOTHING;

INSERT INTO user_division_assignments (user_id, division_id)
VALUES ('c0000000-0000-0000-0000-000000000010', 'd1000000-0000-0000-0000-000000000010')
ON CONFLICT (user_id) DO UPDATE SET division_id = EXCLUDED.division_id;

-- Tharali scheme is in Chamoli/Karanprayag area — move from Haridwar to Karanprayag for correct demo
UPDATE projects SET division_id = 'd1000000-0000-0000-0000-000000000010'
WHERE project_code = 'PRJ-2026-001';
