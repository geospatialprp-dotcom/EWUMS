-- Fix Secretariat login: secretariat@egip.local / Sec@123
-- Run on VPS from deploy/hostinger-kvm/:
--   docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
--     psql -U egip -d egip -v ON_ERROR_STOP=1 \
--     < ../../database/scripts/vps-fix-secretariat-login.sql
--
-- IMPORTANT: After running this script, the secretariat user must LOG OUT and LOG IN
-- again so the API issues a fresh JWT with state:view_all and canViewAllDivisions.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Restore scada_operator if role id 020 was overwritten earlier
UPDATE roles SET code = 'scada_operator', name = 'SCADA Operator'
WHERE id = 'b0000000-0000-0000-0000-000000000020' AND code = 'secretariat';

-- Secretariat role (id 030 — does not clash with ee.ntl user 020 or scada role 020)
INSERT INTO roles (id, tenant_id, code, name, is_system)
VALUES (
  'b0000000-0000-0000-0000-000000000030',
  'a0000000-0000-0000-0000-000000000001',
  'secretariat',
  'Secretariat / Sachiwalaya Officer',
  TRUE
)
ON CONFLICT (id) DO UPDATE SET
  code = 'secretariat',
  name = 'Secretariat / Sachiwalaya Officer';

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000030', p.id, 'organization'
FROM permissions p
WHERE (p.resource = 'dpr_proposal' AND p.action IN ('read', 'approve'))
   OR (p.resource = 'dpr_pdf_review' AND p.action IN ('read', 'annotate', 'comment'))
   OR (p.resource = 'state' AND p.action = 'view_all')
ON CONFLICT DO NOTHING;

-- Create or reset user (by email — safe even if id 020 was wrong before)
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
  password_hash = crypt('Sec@123', gen_salt('bf')),
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  department = EXCLUDED.department,
  status = 'active';

-- Remove wrong role links (e.g. scada_operator on id 020)
DELETE FROM user_roles ur
USING users u, roles r
WHERE ur.user_id = u.id
  AND ur.role_id = r.id
  AND u.email = 'secretariat@egip.local'
  AND r.code <> 'secretariat';

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, 'b0000000-0000-0000-0000-000000000030'
FROM users u
WHERE u.email = 'secretariat@egip.local'
ON CONFLICT DO NOTHING;

-- Verify (pwd_ok must be t)
SELECT
  u.email,
  u.status,
  r.code AS role,
  (crypt('Sec@123', u.password_hash) = u.password_hash) AS pwd_ok
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE u.email = 'secretariat@egip.local';

-- ---------------------------------------------------------------------------
-- VPS hotfix (division-scope only — run if API redeploy is delayed):
--   docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
--     psql -U egip -d egip -v ON_ERROR_STOP=1 -c "
-- INSERT INTO role_permissions (role_id, permission_id, scope)
-- SELECT 'b0000000-0000-0000-0000-000000000030', p.id, 'organization'
-- FROM permissions p WHERE p.resource = 'state' AND p.action = 'view_all'
-- ON CONFLICT DO NOTHING;"
-- Then redeploy API (secretariat in STATE_WIDE_ROLES) and have user re-login.
