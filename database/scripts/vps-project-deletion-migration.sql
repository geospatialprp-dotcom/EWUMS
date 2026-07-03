-- Enable scheme deletion workflow (Super Admin request → Division EE approval).
-- Run on VPS:
--   docker compose -f /opt/egip/deploy/hostinger-kvm/docker-compose.prod.yml exec -T postgres \
--     psql -U egip -d egip -v ON_ERROR_STOP=1 < /opt/egip/database/migrations/096_project_deletion_ee_approval.sql

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'organization'
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND r.code = 'super_admin'
  AND p.resource = 'project'
  AND p.action = 'delete'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'division'
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND r.code = 'ee'
  AND p.resource = 'project'
  AND p.action = 'update'
ON CONFLICT DO NOTHING;

SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'project_deletion_requests'
) AS deletion_table_ready;
