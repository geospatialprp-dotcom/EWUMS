-- Auto-generated statutory clearance proposal package per LA case
CREATE TABLE IF NOT EXISTS la_clearance_proposals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    la_case_id      UUID NOT NULL REFERENCES la_cases(id) ON DELETE CASCADE,
    proposal_no     VARCHAR(80) NOT NULL,
    title           VARCHAR(500) NOT NULL,
    status          VARCHAR(30) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'in_progress', 'submitted', 'approved')),
    package         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (la_case_id)
);

CREATE INDEX IF NOT EXISTS idx_la_clearance_proposals_case ON la_clearance_proposals(la_case_id);

ALTER TABLE la_clearance_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY la_clearance_proposals_tenant ON la_clearance_proposals
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
