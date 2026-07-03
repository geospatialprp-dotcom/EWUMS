-- Quick VPS fix: grant EE work-planning permissions.
-- Run on VPS (fixes error even before API rebuild):
--   docker compose -f /opt/egip/deploy/hostinger-kvm/docker-compose.prod.yml --env-file /opt/egip/deploy/hostinger-kvm/.env \
--     exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 \
--     < /opt/egip/database/scripts/vps-grant-ee-construction-planning.sql

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id,
  CASE WHEN r.code IN ('md', 'cgm', 'ce') THEN 'organization' ELSE 'division' END
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND p.resource = 'construction'
  AND p.action IN ('create', 'update')
  AND r.code IN ('ee', 'se', 'ce', 'cgm', 'md')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000008', p.id, 'division'
FROM permissions p
WHERE p.resource = 'construction'
  AND p.action IN ('create', 'update')
ON CONFLICT DO NOTHING;

SELECT r.code, p.resource || ':' || p.action AS permission, rp.scope
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE p.resource = 'construction'
  AND r.code = 'ee'
ORDER BY p.action;
