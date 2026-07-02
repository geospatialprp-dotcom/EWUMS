-- Project deletion requires Super Admin request + Division EE approval.
-- Also revoke Super Admin post-creation DPR approval (HQ officials own pipeline review).

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

-- Super Admin no longer approves DPR workflow stages (093 rollback).
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND r.code = 'super_admin'
  AND p.resource = 'dpr_proposal'
  AND p.action = 'approve';
