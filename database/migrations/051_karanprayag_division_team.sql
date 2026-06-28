-- Karanprayag division demo team: all roles share the same division and see the same schemes end-to-end.

INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, department, status, division_id)
VALUES
('c0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'je.kpg@egip.local',
 crypt('JE@123', gen_salt('bf')), 'Junior', 'Engineer (KPG)', 'Karanprayag Division', 'active',
 'd1000000-0000-0000-0000-000000000010'),
('c0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'ae.kpg@egip.local',
 crypt('AE@123', gen_salt('bf')), 'Assistant', 'Engineer (KPG)', 'Karanprayag Division', 'active',
 'd1000000-0000-0000-0000-000000000010'),
('c0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 'accounts.kpg@egip.local',
 crypt('Accounts@123', gen_salt('bf')), 'Accounts', 'Officer (KPG)', 'Karanprayag Division', 'active',
 'd1000000-0000-0000-0000-000000000010')
ON CONFLICT (tenant_id, email) DO UPDATE SET
  division_id = EXCLUDED.division_id,
  department = EXCLUDED.department,
  status = 'active';

INSERT INTO user_roles (user_id, role_id) VALUES
('c0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000006'),
('c0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000007'),
('c0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000009')
ON CONFLICT DO NOTHING;

INSERT INTO user_division_assignments (user_id, division_id) VALUES
('c0000000-0000-0000-0000-000000000011', 'd1000000-0000-0000-0000-000000000010'),
('c0000000-0000-0000-0000-000000000012', 'd1000000-0000-0000-0000-000000000010'),
('c0000000-0000-0000-0000-000000000013', 'd1000000-0000-0000-0000-000000000010')
ON CONFLICT (user_id) DO UPDATE SET division_id = EXCLUDED.division_id;
