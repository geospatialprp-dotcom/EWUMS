-- VPS deploy: narrow Super Admin RBAC + project deletion EE approval
-- docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres psql -U egip -d egip -f - < database/scripts/vps-rbac-super-admin-narrow-vps.sql

-- (contents mirror database/migrations/096_project_deletion_ee_approval.sql)

CREATE TABLE IF NOT EXISTS project_deletion_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    division_id     UUID REFERENCES divisions(id) ON DELETE SET NULL,
    requested_by    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          VARCHAR(30) NOT NULL DEFAULT 'pending',
    reason          TEXT,
    ee_remarks      TEXT,
    decided_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    decided_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_deletion_requests_tenant
  ON project_deletion_requests(tenant_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_deletion_pending
  ON project_deletion_requests(project_id)
  WHERE status = 'pending';

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND r.code = 'super_admin'
  AND p.resource = 'dpr_proposal'
  AND p.action = 'approve';
