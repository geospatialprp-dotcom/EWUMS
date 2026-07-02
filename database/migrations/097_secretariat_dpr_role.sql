-- Secretariat role for Stage 7 DPR (Round 2 Govt examination)
-- Demo login: secretariat@egip.local / Sec@123
-- IDs 030 — avoids collision with ee.ntl (user 020) and scada_operator (role 020)

INSERT INTO roles (id, tenant_id, code, name, is_system)
VALUES (
  'b0000000-0000-0000-0000-000000000030',
  'a0000000-0000-0000-0000-000000000001',
  'secretariat',
  'Secretariat / Sachiwalaya Officer',
  TRUE
)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name;

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000030', p.id, 'organization'
FROM permissions p
WHERE p.resource = 'dpr_proposal' AND p.action IN ('read', 'approve', 'update')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000030', p.id, 'organization'
FROM permissions p
WHERE p.resource = 'dpr_pdf_review' AND p.action IN ('read', 'annotate', 'comment')
ON CONFLICT DO NOTHING;

-- Statewide division scope (belt-and-suspenders for JWT at login; matches STATE_WIDE_ROLES in API)
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000030', p.id, 'organization'
FROM permissions p
WHERE p.resource = 'state' AND p.action = 'view_all'
ON CONFLICT DO NOTHING;

INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, department, status)
VALUES (
  'c0000000-0000-0000-0000-000000000030',
  'a0000000-0000-0000-0000-000000000001',
  'secretariat@egip.local',
  crypt('Sec@123', gen_salt('bf')),
  'Sachiwalaya',
  'Secretariat Officer',
  'Secretariat',
  'active'
)
ON CONFLICT (tenant_id, email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  department = EXCLUDED.department,
  status = 'active';

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, 'b0000000-0000-0000-0000-000000000030'
FROM users u
WHERE u.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND u.email = 'secretariat@egip.local'
ON CONFLICT DO NOTHING;
