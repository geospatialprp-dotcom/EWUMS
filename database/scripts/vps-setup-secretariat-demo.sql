-- Create / reset Secretariat demo user for Stage 7 DPR
-- Login: secretariat@egip.local / Sec@123
--
-- cd /opt/egip/deploy/hostinger-kvm
-- docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
--   psql -U egip -d egip -v ON_ERROR_STOP=1 \
--   < ../../database/scripts/vps-setup-secretariat-demo.sql

-- Restore scada_operator if a prior run overwrote role id 020
UPDATE roles SET code = 'scada_operator', name = 'SCADA Operator'
WHERE id = 'b0000000-0000-0000-0000-000000000020'
  AND code = 'secretariat';

INSERT INTO roles (id, tenant_id, code, name, is_system)
VALUES (
  'b0000000-0000-0000-0000-000000000030',
  'a0000000-0000-0000-0000-000000000001',
  'secretariat',
  'Secretariat / Sachiwalaya Officer',
  TRUE
)
ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name;

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000030', p.id, 'organization'
FROM permissions p
WHERE p.resource = 'dpr_proposal' AND p.action IN ('read', 'approve')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000030', p.id, 'organization'
FROM permissions p
WHERE p.resource = 'dpr_pdf_review' AND p.action IN ('read', 'annotate', 'comment')
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
  status = 'active';

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, 'b0000000-0000-0000-0000-000000000030'
FROM users u
WHERE u.email = 'secretariat@egip.local'
ON CONFLICT DO NOTHING;

SELECT u.email, u.status, r.code AS role
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE u.email = 'secretariat@egip.local';
