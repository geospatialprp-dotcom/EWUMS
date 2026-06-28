-- Nainital division demo: scheme + EE/JE/AE/Accounts team (mirrors Karanprayag setup).

INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, department, status, division_id)
VALUES
('c0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000001', 'ee.ntl@egip.local',
 crypt('EE@123', gen_salt('bf')), 'Executive', 'Engineer (NTL)', 'Nainital Division', 'active',
 'd1000000-0000-0000-0000-000000000003'),
('c0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000001', 'je.ntl@egip.local',
 crypt('JE@123', gen_salt('bf')), 'Junior', 'Engineer (NTL)', 'Nainital Division', 'active',
 'd1000000-0000-0000-0000-000000000003'),
('c0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000001', 'ae.ntl@egip.local',
 crypt('AE@123', gen_salt('bf')), 'Assistant', 'Engineer (NTL)', 'Nainital Division', 'active',
 'd1000000-0000-0000-0000-000000000003'),
('c0000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-000000000001', 'accounts.ntl@egip.local',
 crypt('Accounts@123', gen_salt('bf')), 'Accounts', 'Officer (NTL)', 'Nainital Division', 'active',
 'd1000000-0000-0000-0000-000000000003')
ON CONFLICT (tenant_id, email) DO UPDATE SET
  division_id = EXCLUDED.division_id,
  department = EXCLUDED.department,
  status = 'active';

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.role_id
FROM (VALUES
  ('ee.ntl@egip.local', 'b0000000-0000-0000-0000-000000000008'::uuid),
  ('je.ntl@egip.local', 'b0000000-0000-0000-0000-000000000006'::uuid),
  ('ae.ntl@egip.local', 'b0000000-0000-0000-0000-000000000007'::uuid),
  ('accounts.ntl@egip.local', 'b0000000-0000-0000-0000-000000000009'::uuid)
) AS r(email, role_id)
INNER JOIN users u ON u.email = r.email AND u.tenant_id = 'a0000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

INSERT INTO user_division_assignments (user_id, division_id)
SELECT u.id, 'd1000000-0000-0000-0000-000000000003'
FROM users u
WHERE u.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND u.email IN ('ee.ntl@egip.local', 'je.ntl@egip.local', 'ae.ntl@egip.local', 'accounts.ntl@egip.local', 'accounts@egip.local')
ON CONFLICT (user_id) DO UPDATE SET division_id = EXCLUDED.division_id;

UPDATE users SET division_id = 'd1000000-0000-0000-0000-000000000003'
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND email = 'accounts@egip.local';

INSERT INTO projects (
  id, tenant_id, project_code, name, description, status,
  start_date, end_date, budget, spent, physical_progress, financial_progress,
  division_id, manager_id
)
SELECT
  'f0000000-0000-0000-0000-000000000020',
  'a0000000-0000-0000-0000-000000000001',
  'PRJ-BWSS-2026-27',
  'Badhangarhi Water Supply Scheme',
  'Rural piped water supply for Badhangarhi GP — Nainital Division demo scheme.',
  'active',
  '2026-04-01',
  '2027-03-31',
  18500000,
  4200000,
  22,
  18,
  'd1000000-0000-0000-0000-000000000003',
  u.id
FROM users u
WHERE u.email = 'ee.ntl@egip.local'
  AND u.tenant_id = 'a0000000-0000-0000-0000-000000000001'
ON CONFLICT (id) DO UPDATE SET
  division_id = EXCLUDED.division_id,
  name = EXCLUDED.name,
  project_code = EXCLUDED.project_code,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  manager_id = EXCLUDED.manager_id;

DELETE FROM project_milestones WHERE project_id = 'f0000000-0000-0000-0000-000000000020';

INSERT INTO project_milestones (project_id, name, due_date, status, progress, sort_order) VALUES
('f0000000-0000-0000-0000-000000000020', 'Survey & DPR', '2026-06-30', 'in_progress', 60, 1),
('f0000000-0000-0000-0000-000000000020', 'Pipeline Laying', '2026-12-31', 'pending', 0, 2),
('f0000000-0000-0000-0000-000000000020', 'FHTC Connections', '2027-02-28', 'pending', 0, 3),
('f0000000-0000-0000-0000-000000000020', 'Testing & Commissioning', '2027-03-31', 'pending', 0, 4);

UPDATE dpr_proposals
SET division_id = 'd1000000-0000-0000-0000-000000000003'
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND title ILIKE '%Badhangarhi%'
  AND division_id IS DISTINCT FROM 'd1000000-0000-0000-0000-000000000010';
