-- EWUMS/UJS Presentation Demo Seed — Dehradun North & Haridwar Rural
-- Run AFTER all migrations through 084_dehradun_field_divisions.sql
-- Safe to re-run: uses ON CONFLICT / conditional inserts
-- No secrets — demo passwords match 014_reset_demo_passwords.sql patterns
--
-- Usage:
--   psql -U egip -d egip -f docs/ujs-presentation/demo-seed.sql

BEGIN;

-- ── Constants ─────────────────────────────────────────────────────────────
-- Tenant: a0000000-0000-0000-0000-000000000001
-- DIV-DNN: d1000000-0000-0000-0000-000000000022
-- DIV-HRR: d1000000-0000-0000-0000-000000000026
-- Project DNN: f0000000-0000-0000-0000-000000000030
-- Project HRR: f0000000-0000-0000-0000-000000000031

-- ── 1. Division team users ────────────────────────────────────────────────

INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, department, status, division_id)
VALUES
('c0000000-0000-0000-0000-000000000030', 'a0000000-0000-0000-0000-000000000001', 'ee.dnn@egip.local',
 crypt('EE@123', gen_salt('bf')), 'Executive', 'Engineer (DNN)', 'Dehradun North Division', 'active',
 'd1000000-0000-0000-0000-000000000022'),
('c0000000-0000-0000-0000-000000000031', 'a0000000-0000-0000-0000-000000000001', 'je.dnn@egip.local',
 crypt('JE@123', gen_salt('bf')), 'Junior', 'Engineer (DNN)', 'Dehradun North Division', 'active',
 'd1000000-0000-0000-0000-000000000022'),
('c0000000-0000-0000-0000-000000000032', 'a0000000-0000-0000-0000-000000000001', 'ae.dnn@egip.local',
 crypt('AE@123', gen_salt('bf')), 'Assistant', 'Engineer (DNN)', 'Dehradun North Division', 'active',
 'd1000000-0000-0000-0000-000000000022'),
('c0000000-0000-0000-0000-000000000033', 'a0000000-0000-0000-0000-000000000001', 'accounts.dnn@egip.local',
 crypt('Accounts@123', gen_salt('bf')), 'Accounts', 'Officer (DNN)', 'Dehradun North Division', 'active',
 'd1000000-0000-0000-0000-000000000022'),
('c0000000-0000-0000-0000-000000000034', 'a0000000-0000-0000-0000-000000000001', 'ee.hrr@egip.local',
 crypt('EE@123', gen_salt('bf')), 'Executive', 'Engineer (HRR)', 'Haridwar Rural Division', 'active',
 'd1000000-0000-0000-0000-000000000026'),
('c0000000-0000-0000-0000-000000000035', 'a0000000-0000-0000-0000-000000000001', 'je.hrr@egip.local',
 crypt('JE@123', gen_salt('bf')), 'Junior', 'Engineer (HRR)', 'Haridwar Rural Division', 'active',
 'd1000000-0000-0000-0000-000000000026'),
('c0000000-0000-0000-0000-000000000036', 'a0000000-0000-0000-0000-000000000001', 'ae.hrr@egip.local',
 crypt('AE@123', gen_salt('bf')), 'Assistant', 'Engineer (HRR)', 'Haridwar Rural Division', 'active',
 'd1000000-0000-0000-0000-000000000026'),
('c0000000-0000-0000-0000-000000000037', 'a0000000-0000-0000-0000-000000000001', 'accounts.hrr@egip.local',
 crypt('Accounts@123', gen_salt('bf')), 'Accounts', 'Officer (HRR)', 'Haridwar Rural Division', 'active',
 'd1000000-0000-0000-0000-000000000026')
ON CONFLICT (tenant_id, email) DO UPDATE SET
  division_id = EXCLUDED.division_id,
  department = EXCLUDED.department,
  status = 'active';

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.role_id
FROM (VALUES
  ('ee.dnn@egip.local', 'b0000000-0000-0000-0000-000000000008'::uuid),
  ('je.dnn@egip.local', 'b0000000-0000-0000-0000-000000000006'::uuid),
  ('ae.dnn@egip.local', 'b0000000-0000-0000-0000-000000000007'::uuid),
  ('accounts.dnn@egip.local', 'b0000000-0000-0000-0000-000000000009'::uuid),
  ('ee.hrr@egip.local', 'b0000000-0000-0000-0000-000000000008'::uuid),
  ('je.hrr@egip.local', 'b0000000-0000-0000-0000-000000000006'::uuid),
  ('ae.hrr@egip.local', 'b0000000-0000-0000-0000-000000000007'::uuid),
  ('accounts.hrr@egip.local', 'b0000000-0000-0000-0000-000000000009'::uuid)
) AS r(email, role_id)
INNER JOIN users u ON u.email = r.email AND u.tenant_id = 'a0000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

INSERT INTO user_division_assignments (user_id, division_id)
SELECT u.id, u.division_id
FROM users u
WHERE u.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND u.email IN (
    'ee.dnn@egip.local', 'je.dnn@egip.local', 'ae.dnn@egip.local', 'accounts.dnn@egip.local',
    'ee.hrr@egip.local', 'je.hrr@egip.local', 'ae.hrr@egip.local', 'accounts.hrr@egip.local'
  )
  AND u.division_id IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET division_id = EXCLUDED.division_id;

-- Grant dashboard:read already via role_permissions in 081; ensure EE/JE have construction perms via roles

-- ── 2. Pilot schemes (projects) ───────────────────────────────────────────

INSERT INTO projects (
  id, tenant_id, project_code, name, description, status,
  start_date, end_date, budget, spent, physical_progress, financial_progress,
  division_id, manager_id
)
SELECT
  'f0000000-0000-0000-0000-000000000030',
  'a0000000-0000-0000-0000-000000000001',
  'PRJ-DNN-CTWSS-26',
  'Clement Town Water Supply Scheme',
  'Urban piped water supply augmentation — Dehradun North Division (DIV-DNN) presentation demo.',
  'active',
  '2025-10-01', '2026-09-30',
  24500000, 15925000, 72, 65,
  'd1000000-0000-0000-0000-000000000022',
  u.id
FROM users u WHERE u.email = 'ee.dnn@egip.local'
ON CONFLICT (id) DO UPDATE SET
  division_id = EXCLUDED.division_id,
  name = EXCLUDED.name,
  project_code = EXCLUDED.project_code,
  description = EXCLUDED.description,
  physical_progress = EXCLUDED.physical_progress,
  financial_progress = EXCLUDED.financial_progress,
  manager_id = EXCLUDED.manager_id;

INSERT INTO projects (
  id, tenant_id, project_code, name, description, status,
  start_date, end_date, budget, spent, physical_progress, financial_progress,
  division_id, manager_id
)
SELECT
  'f0000000-0000-0000-0000-000000000031',
  'a0000000-0000-0000-0000-000000000001',
  'PRJ-HRR-BHD-26',
  'Bahadarabad Rural WSS',
  'JJM rural piped water supply — Haridwar Rural Division (DIV-HRR) presentation demo.',
  'active',
  '2025-11-01', '2026-10-31',
  16800000, 8064000, 55, 48,
  'd1000000-0000-0000-0000-000000000026',
  u.id
FROM users u WHERE u.email = 'ee.hrr@egip.local'
ON CONFLICT (id) DO UPDATE SET
  division_id = EXCLUDED.division_id,
  name = EXCLUDED.name,
  project_code = EXCLUDED.project_code,
  description = EXCLUDED.description,
  physical_progress = EXCLUDED.physical_progress,
  financial_progress = EXCLUDED.financial_progress,
  manager_id = EXCLUDED.manager_id;

DELETE FROM project_milestones WHERE project_id IN (
  'f0000000-0000-0000-0000-000000000030',
  'f0000000-0000-0000-0000-000000000031'
);

INSERT INTO project_milestones (project_id, name, due_date, status, progress, sort_order) VALUES
('f0000000-0000-0000-0000-000000000030', 'Survey & DPR', '2025-12-31', 'completed', 100, 1),
('f0000000-0000-0000-0000-000000000030', 'Pipeline Laying', '2026-06-30', 'in_progress', 75, 2),
('f0000000-0000-0000-0000-000000000030', 'FHTC Connections', '2026-08-31', 'in_progress', 40, 3),
('f0000000-0000-0000-0000-000000000030', 'Testing & Commissioning', '2026-09-15', 'pending', 0, 4),
('f0000000-0000-0000-0000-000000000031', 'Survey & DPR', '2026-01-31', 'completed', 100, 1),
('f0000000-0000-0000-0000-000000000031', 'Gravity Main Laying', '2026-07-31', 'in_progress', 60, 2),
('f0000000-0000-0000-0000-000000000031', 'FHTC Connections', '2026-09-30', 'pending', 15, 3),
('f0000000-0000-0000-0000-000000000031', 'Testing & Commissioning', '2026-10-15', 'pending', 0, 4);

-- ── 3. BOQ items (subset for demo) ────────────────────────────────────────

INSERT INTO boq_items (tenant_id, project_id, scheme_type, component, item_code, description, unit, contract_qty, revised_qty, rate, sort_order)
VALUES
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000030', 'gravity', 'gravity_main', 'DNN-GR-01', 'DI pipe laying 150mm — Clement Town main', 'rm', 3200, 3200, 980.00, 1),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000030', 'gravity', 'reservoir', 'DNN-RS-01', 'GLSR 100 KL — Patel Nagar', 'cum', 120, 120, 4500.00, 2),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000030', 'gravity', 'fhtc', 'DNN-FH-01', 'FHTC connection with meter', 'nos', 450, 450, 2400.00, 3),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000031', 'gravity', 'gravity_main', 'HRR-GR-01', 'HDPE pipe 90mm — Bahadarabad ring main', 'rm', 4800, 4800, 720.00, 1),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000031', 'gravity', 'fhtc', 'HRR-FH-01', 'FHTC rural connection', 'nos', 380, 380, 2100.00, 2)
ON CONFLICT (project_id, item_code) DO NOTHING;

-- ── 4. Work packages ──────────────────────────────────────────────────────

INSERT INTO work_packages (id, tenant_id, project_id, package_code, name, component, scheme_type, contractor_name, status, gis_alignment_status)
VALUES
('w1000000-0000-0000-0000-000000000030', 'a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000030',
 'WP-DNN-01', 'Clement Town Gravity Main', 'gravity_main', 'gravity', 'UJS Empanelled Contractor — Demo', 'in_progress', 'approved'),
('w1000000-0000-0000-0000-000000000031', 'a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000031',
 'WP-HRR-01', 'Bahadarabad Ring Main', 'gravity_main', 'gravity', 'Rural WSS Contractor — Demo', 'in_progress', 'approved')
ON CONFLICT (project_id, package_code) DO UPDATE SET status = EXCLUDED.status;

-- ── 5. Measurement book + entries ─────────────────────────────────────────

INSERT INTO measurement_books (
  id, tenant_id, project_id, mb_number, scheme_type, measurement_date,
  site_location, status, je_measured_by, je_measured_at, work_package_id
)
SELECT
  'm1000000-0000-0000-0000-000000000030',
  'a0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000030',
  'MB-DNN-001', 'gravity', CURRENT_DATE - 14,
  'Clement Town — Ch 0+000 to 1+200', 'pending_ae',
  u.id, NOW() - INTERVAL '14 days',
  'w1000000-0000-0000-0000-000000000030'
FROM users u WHERE u.email = 'je.dnn@egip.local'
ON CONFLICT (project_id, mb_number) DO UPDATE SET status = EXCLUDED.status;

INSERT INTO mb_entries (mb_id, boq_item_id, item_code, description, unit, measured_qty, rate, sort_order)
SELECT
  'm1000000-0000-0000-0000-000000000030',
  b.id, 'DNN-GR-01', 'DI pipe laying 150mm — Clement Town main', 'rm', 850.000, 980.00, 1
FROM boq_items b
WHERE b.project_id = 'f0000000-0000-0000-0000-000000000030' AND b.item_code = 'DNN-GR-01'
  AND NOT EXISTS (
    SELECT 1 FROM mb_entries e
    WHERE e.mb_id = 'm1000000-0000-0000-0000-000000000030' AND e.item_code = 'DNN-GR-01'
  );

-- ── 6. RA Bill (pending AE approval — demo workflow) ──────────────────────

INSERT INTO ra_bills (
  id, tenant_id, project_id, ra_number, ra_sequence,
  billing_period_from, billing_period_to, scheme_type, status,
  gross_amount, previous_amount, net_payable, submitted_by, submitted_at
)
SELECT
  'r1000000-0000-0000-0000-000000000030',
  'a0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000030',
  'RA-DNN-01', 1,
  CURRENT_DATE - 45, CURRENT_DATE - 15, 'gravity', 'pending_ae',
  833000.00, 0, 833000.00,
  u.id, NOW() - INTERVAL '3 days'
FROM users u WHERE u.email = 'je.dnn@egip.local'
ON CONFLICT (project_id, ra_number) DO UPDATE SET status = EXCLUDED.status;

-- ── 7. GIS-linked assets (Dehradun / Haridwar coordinates) ───────────────

INSERT INTO assets (id, tenant_id, asset_code, asset_type_id, name, status, health_score, geometry, attributes, project_id, created_by)
SELECT
  'a1000000-0000-0000-0000-000000000030',
  'a0000000-0000-0000-0000-000000000001',
  'DNN-GLSR-01',
  t.id,
  'GLSR 100 KL — Patel Nagar',
  'active', 88,
  ST_GeomFromText('POLYGON((78.048 30.325, 78.050 30.325, 78.050 30.327, 78.048 30.327, 78.048 30.325))', 4326),
  '{"capacity_kl":100,"division":"Dehradun North"}'::jsonb,
  'f0000000-0000-0000-0000-000000000030',
  u.id
FROM asset_types t, users u
WHERE t.tenant_id = 'a0000000-0000-0000-0000-000000000001' AND t.code = 'glsr'
  AND u.email = 'je.dnn@egip.local'
ON CONFLICT (tenant_id, asset_code) DO UPDATE SET
  project_id = EXCLUDED.project_id,
  geometry = EXCLUDED.geometry,
  health_score = EXCLUDED.health_score;

INSERT INTO assets (id, tenant_id, asset_code, asset_type_id, name, status, health_score, geometry, attributes, project_id, created_by)
SELECT
  'a1000000-0000-0000-0000-000000000031',
  'a0000000-0000-0000-0000-000000000001',
  'DNN-PH-01',
  t.id,
  'Booster Pump House — Clement Town',
  'active', 76,
  ST_GeomFromText('POINT(78.049 30.326)', 4326),
  '{"capacity_lps":85}'::jsonb,
  'f0000000-0000-0000-0000-000000000030',
  u.id
FROM asset_types t, users u
WHERE t.tenant_id = 'a0000000-0000-0000-0000-000000000001' AND t.code IN ('pump_house', 'pump')
  AND u.email = 'je.dnn@egip.local'
ORDER BY CASE WHEN t.code = 'pump_house' THEN 0 ELSE 1 END
LIMIT 1
ON CONFLICT (tenant_id, asset_code) DO UPDATE SET project_id = EXCLUDED.project_id;

INSERT INTO assets (id, tenant_id, asset_code, asset_type_id, name, status, health_score, geometry, attributes, project_id, created_by)
SELECT
  'a1000000-0000-0000-0000-000000000032',
  'a0000000-0000-0000-0000-000000000001',
  'DNN-AV-01',
  t.id,
  'Air Valve — Ch 0+800',
  'critical', 42,
  ST_GeomFromText('POINT(78.051 30.324)', 4326),
  '{"chainage":"0+800"}'::jsonb,
  'f0000000-0000-0000-0000-000000000030',
  u.id
FROM asset_types t, users u
WHERE t.tenant_id = 'a0000000-0000-0000-0000-000000000001' AND t.code = 'air_valve'
  AND u.email = 'je.dnn@egip.local'
ON CONFLICT (tenant_id, asset_code) DO UPDATE SET status = EXCLUDED.status, health_score = EXCLUDED.health_score;

INSERT INTO assets (id, tenant_id, asset_code, asset_type_id, name, status, health_score, geometry, attributes, project_id, created_by)
SELECT
  'a1000000-0000-0000-0000-000000000033',
  'a0000000-0000-0000-0000-000000000001',
  'HRR-GLSR-01',
  t.id,
  'GLSR 50 KL — Bahadarabad',
  'active', 91,
  ST_GeomFromText('POLYGON((78.085 29.948, 78.087 29.948, 78.087 29.950, 78.085 29.950, 78.085 29.948))', 4326),
  '{"capacity_kl":50}'::jsonb,
  'f0000000-0000-0000-0000-000000000031',
  u.id
FROM asset_types t, users u
WHERE t.tenant_id = 'a0000000-0000-0000-0000-000000000001' AND t.code = 'glsr'
  AND u.email = 'je.hrr@egip.local'
ON CONFLICT (tenant_id, asset_code) DO UPDATE SET project_id = EXCLUDED.project_id;

INSERT INTO assets (id, tenant_id, asset_code, asset_type_id, name, status, health_score, geometry, attributes, project_id, created_by)
SELECT
  'a1000000-0000-0000-0000-000000000034',
  'a0000000-0000-0000-0000-000000000001',
  'DNN-PL-01',
  t.id,
  'Gravity Main — Clement Town',
  'active', 85,
  ST_GeomFromText('LINESTRING(78.047 30.323, 78.052 30.326, 78.055 30.328)', 4326),
  '{"diameter_mm":150,"material":"DI"}'::jsonb,
  'f0000000-0000-0000-0000-000000000030',
  u.id
FROM asset_types t, users u
WHERE t.tenant_id = 'a0000000-0000-0000-0000-000000000001' AND t.code = 'gravity_main'
  AND u.email = 'je.dnn@egip.local'
ON CONFLICT (tenant_id, asset_code) DO UPDATE SET project_id = EXCLUDED.project_id;

-- ── 8. IoT devices & alerts (Executive Dashboard feed) ────────────────────

INSERT INTO iot_devices (id, tenant_id, asset_id, device_code, name, device_type, status, location, last_seen_at)
SELECT
  'i1000000-0000-0000-0000-000000000030',
  'a0000000-0000-0000-0000-000000000001',
  a.id, 'IOT-DNN-PH-01', 'Clement Town Pressure Sensor', 'pressure', 'active',
  ST_GeomFromText('POINT(78.049 30.326)', 4326), NOW() - INTERVAL '3 minutes'
FROM assets a WHERE a.asset_code = 'DNN-PH-01'
ON CONFLICT (id) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at;

INSERT INTO iot_devices (id, tenant_id, asset_id, device_code, name, device_type, status, location, last_seen_at)
SELECT
  'i1000000-0000-0000-0000-000000000031',
  'a0000000-0000-0000-0000-000000000001',
  a.id, 'IOT-DNN-RS-01', 'Patel Nagar Level Sensor', 'water_level', 'active',
  ST_GeomFromText('POINT(78.049 30.326)', 4326), NOW() - INTERVAL '8 minutes'
FROM assets a WHERE a.asset_code = 'DNN-GLSR-01'
ON CONFLICT (id) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at;

DELETE FROM iot_alerts WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND device_id IN ('i1000000-0000-0000-0000-000000000030', 'i1000000-0000-0000-0000-000000000031');

INSERT INTO iot_alerts (tenant_id, device_id, severity, message, metric, value, acknowledged)
VALUES
('a0000000-0000-0000-0000-000000000001', 'i1000000-0000-0000-0000-000000000030',
 'critical', 'Pressure below threshold — Clement Town Zone B', 'pressure_bar', 1.1, false),
('a0000000-0000-0000-0000-000000000001', 'i1000000-0000-0000-0000-000000000031',
 'warning', 'Reservoir level at 62% — schedule refill check', 'level_pct', 62, false);

-- ── 9. DPR proposal (Dehradun North pipeline) ─────────────────────────────

INSERT INTO dpr_proposals (
  id, tenant_id, proposal_no, title, division_id, project_id,
  initiated_by, current_stage, status, scheme_justification, preliminary_estimate, priority,
  latitude, longitude
)
SELECT
  'p1000000-0000-0000-0000-000000000030',
  'a0000000-0000-0000-0000-000000000001',
  'DPR-DNN-2026-001',
  'Clement Town Distribution Network Extension',
  'd1000000-0000-0000-0000-000000000022',
  'f0000000-0000-0000-0000-000000000030',
  u.id, 4, 'tac_review',
  'Extend distribution mains to uncovered wards in Dehradun North Division.',
  4200000.00, 'high',
  30.326, 78.049
FROM users u WHERE u.email = 'ee.dnn@egip.local'
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, title = EXCLUDED.title;

-- ── 10. Consumers & billing (Haridwar Rural demo) ─────────────────────────

INSERT INTO om_consumers (
  id, tenant_id, project_id, consumer_code, fhtc_number, consumer_name, mobile,
  village, ward, consumer_category, connection_status, latitude, longitude, notes
)
VALUES
('c2000000-0000-0000-0000-000000000031', 'a0000000-0000-0000-0000-000000000001',
 'f0000000-0000-0000-0000-000000000031', 'CON-HRR-00001', 'FHTC-HRR-DEMO-001',
 'Shri Ram Kumar', '9876500101', 'Bahadarabad', 'Ward 2', 'apl', 'active', 29.949, 78.086,
 'Haridwar Rural demo consumer — Jal Mitra portal'),
('c2000000-0000-0000-0000-000000000032', 'a0000000-0000-0000-0000-000000000001',
 'f0000000-0000-0000-0000-000000000030', 'CON-DNN-00001', 'FHTC-DNN-DEMO-001',
 'Smt. Priya Devi', '9876500201', 'Clement Town', 'Ward 5', 'apl', 'active', 30.325, 78.050,
 'Dehradun North demo consumer')
ON CONFLICT (tenant_id, fhtc_number) DO UPDATE SET
  project_id = EXCLUDED.project_id,
  village = EXCLUDED.village;

INSERT INTO om_billing_tariffs (
  id, tenant_id, project_id, tariff_code, tariff_name, consumer_category,
  billing_cycle, fixed_charge, slabs, effective_from, status
)
VALUES (
  't1000000-0000-0000-0000-000000000031',
  'a0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000031',
  'TAR-HRR-DOM-26',
  'Haridwar Rural Domestic APL 2026',
  'apl', 'monthly', 75.00,
  '[{"from_kl":0,"to_kl":10,"rate":4.5},{"from_kl":10,"to_kl":20,"rate":6.0},{"from_kl":20,"to_kl":null,"rate":8.5}]'::jsonb,
  '2026-01-01', 'active'
)
ON CONFLICT (tenant_id, tariff_code) DO NOTHING;

INSERT INTO om_meter_readings (tenant_id, consumer_id, reading_date, reading_method, previous_reading, current_reading, consumption_kl, recorded_by)
SELECT
  'a0000000-0000-0000-0000-000000000001',
  'c2000000-0000-0000-0000-000000000031',
  DATE '2026-05-01', 'manual', 120.000, 128.500, 8.500,
  u.id
FROM users u WHERE u.email = 'je.hrr@egip.local'
ON CONFLICT (consumer_id, reading_date) DO NOTHING;

INSERT INTO om_consumer_bills (
  id, tenant_id, project_id, consumer_id, tariff_id, bill_no,
  billing_period_from, billing_period_to,
  previous_reading, current_reading, consumption_kl,
  water_charge, fixed_charge, total_amount, amount_paid, balance_amount, status, due_date, issued_at
)
VALUES (
  'b1000000-0000-0000-0000-000000000031',
  'a0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000031',
  'c2000000-0000-0000-0000-000000000031',
  't1000000-0000-0000-0000-000000000031',
  'BILL-HRR-2026-05-001',
  '2026-05-01', '2026-05-31',
  120.000, 128.500, 8.500,
  48.75, 75.00, 123.75, 123.75, 0, 'paid', '2026-06-15', NOW() - INTERVAL '20 days'
)
ON CONFLICT (tenant_id, bill_no) DO NOTHING;

INSERT INTO om_billing_payments (tenant_id, consumer_id, bill_id, receipt_no, payment_date, payment_mode, amount)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'c2000000-0000-0000-0000-000000000031',
  'b1000000-0000-0000-0000-000000000031',
  'RCP-HRR-2026-001', CURRENT_DATE - 18, 'upi', 123.75
)
ON CONFLICT DO NOTHING;

-- ── 11. Audit trail entries (presentation demo) ───────────────────────────

INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, details, created_at)
SELECT
  'a0000000-0000-0000-0000-000000000001', u.id, a.action, a.resource_type, a.resource_id, a.details::jsonb,
  NOW() - a.age
FROM (VALUES
  ('je.dnn@egip.local', 'auth.login', 'session', NULL, '{"method":"password"}', INTERVAL '2 hours'),
  ('je.dnn@egip.local', 'mb.create', 'measurement_book', 'm1000000-0000-0000-0000-000000000030', '{"mb_number":"MB-DNN-001"}', INTERVAL '14 days'),
  ('je.dnn@egip.local', 'ra_bill.submit', 'ra_bill', 'r1000000-0000-0000-0000-000000000030', '{"ra_number":"RA-DNN-01"}', INTERVAL '3 days'),
  ('ae.dnn@egip.local', 'workflow.approve', 'workflow_task', NULL, '{"step":"JE Verification"}', INTERVAL '13 days'),
  ('ee.dnn@egip.local', 'dashboard.view', 'dashboard', NULL, '{"page":"executive"}', INTERVAL '1 day'),
  ('gis@egip.local', 'layer.view', 'gis_layer', NULL, '{"layer":"Dehradun district"}', INTERVAL '5 hours'),
  ('je.hrr@egip.local', 'consumer.create', 'om_consumer', 'c2000000-0000-0000-0000-000000000031', '{"fhtc":"FHTC-HRR-DEMO-001"}', INTERVAL '30 days'),
  ('accounts.hrr@egip.local', 'billing.payment', 'om_billing_payment', NULL, '{"receipt":"RCP-HRR-2026-001"}', INTERVAL '18 days'),
  ('admin@egip.local', 'user.view', 'user', NULL, '{"scope":"statewide"}', INTERVAL '6 hours'),
  ('ee.hrr@egip.local', 'project.update', 'project', 'f0000000-0000-0000-0000-000000000031', '{"field":"physical_progress"}', INTERVAL '7 days')
) AS a(email, action, resource_type, resource_id, details, age)
INNER JOIN users u ON u.email = a.email;

COMMIT;

-- Verification queries (optional — run manually):
-- SELECT code, name FROM divisions WHERE code IN ('DIV-DNN','DIV-HRR');
-- SELECT project_code, name, physical_progress FROM projects WHERE project_code LIKE 'PRJ-%DNN%' OR project_code LIKE 'PRJ-HRR%';
-- SELECT email, division_id FROM users WHERE email LIKE '%.dnn@egip.local' OR email LIKE '%.hrr@egip.local';
