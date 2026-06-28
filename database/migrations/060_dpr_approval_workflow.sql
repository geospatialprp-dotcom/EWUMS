-- DPR Approval, Technical Review, Administrative Sanction & Tendering workflow

CREATE TABLE IF NOT EXISTS dpr_proposals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    proposal_no         VARCHAR(50) NOT NULL,
    title               VARCHAR(500) NOT NULL,
    division_id         UUID REFERENCES divisions(id) ON DELETE SET NULL,
    project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
    initiated_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    current_stage       SMALLINT NOT NULL DEFAULT 1,
    status              VARCHAR(80) NOT NULL DEFAULT 'proposal_draft',
    scheme_justification TEXT,
    preliminary_estimate NUMERIC(14, 2),
    funding_source      VARCHAR(255),
    priority            VARCHAR(30) DEFAULT 'medium',
    gis_boundary        JSONB,
    latitude            DOUBLE PRECISION,
    longitude           DOUBLE PRECISION,
    hq_remarks          TEXT,
    tac_round1_remarks  TEXT,
    tac_round2_remarks  TEXT,
    secretariat_ref     VARCHAR(100),
    secretariat_forwarded_at TIMESTAMPTZ,
    workflow_instance_id UUID REFERENCES workflow_instances(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    closed_at           TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dpr_proposals_no ON dpr_proposals(tenant_id, proposal_no);
CREATE INDEX IF NOT EXISTS idx_dpr_proposals_division ON dpr_proposals(tenant_id, division_id);
CREATE INDEX IF NOT EXISTS idx_dpr_proposals_status ON dpr_proposals(tenant_id, status);

CREATE TABLE IF NOT EXISTS dpr_proposal_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    proposal_id     UUID NOT NULL REFERENCES dpr_proposals(id) ON DELETE CASCADE,
    document_type   VARCHAR(80) NOT NULL,
    file_name       VARCHAR(500),
    file_url        TEXT,
    version_no      INT NOT NULL DEFAULT 1,
    uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    remarks         TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dpr_docs_proposal ON dpr_proposal_documents(proposal_id, document_type);

CREATE TABLE IF NOT EXISTS dpr_workflow_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    proposal_id     UUID NOT NULL REFERENCES dpr_proposals(id) ON DELETE CASCADE,
    stage           SMALLINT NOT NULL,
    action          VARCHAR(80) NOT NULL,
    from_status     VARCHAR(80),
    to_status       VARCHAR(80),
    actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_role      VARCHAR(50),
    comments        TEXT,
    payload         JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dpr_events_proposal ON dpr_workflow_events(proposal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS dpr_sanctions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    proposal_id         UUID NOT NULL REFERENCES dpr_proposals(id) ON DELETE CASCADE,
    administrative_approval_no VARCHAR(100),
    expenditure_sanction_no    VARCHAR(100),
    sanctioned_amount   NUMERIC(14, 2),
    budget_head         VARCHAR(255),
    sanction_date       DATE,
    funding_release_ref VARCHAR(100),
    document_url        TEXT,
    recorded_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dpr_sanctions_proposal ON dpr_sanctions(proposal_id);

CREATE TABLE IF NOT EXISTS dpr_tender_packages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    proposal_id     UUID NOT NULL REFERENCES dpr_proposals(id) ON DELETE CASCADE,
    package_no      VARCHAR(50) NOT NULL,
    status          VARCHAR(50) NOT NULL DEFAULT 'prep_initiated',
    boq_final_url   TEXT,
    nit_ref         VARCHAR(100),
    bid_document_url TEXT,
    published_at    TIMESTAMPTZ,
    task_order_ref  VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dpr_tender_proposal ON dpr_tender_packages(proposal_id);

-- Permissions
INSERT INTO permissions (resource, action, description) VALUES
  ('dpr_proposal', 'read', 'View DPR proposals and pipeline'),
  ('dpr_proposal', 'create', 'Initiate DPR proposals'),
  ('dpr_proposal', 'update', 'Update DPR preparation documents'),
  ('dpr_proposal', 'approve', 'Approve DPR workflow stages')
ON CONFLICT (resource, action) DO NOTHING;

-- Grant to EE, SE, CE, CGM, MD, super_admin, JE, AE
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND p.resource = 'dpr_proposal'
  AND r.code IN ('super_admin', 'ee', 'se', 'ce', 'cgm', 'md', 'je', 'ae')
ON CONFLICT DO NOTHING;

-- Workflow definitions for key gates
INSERT INTO workflow_definitions (id, tenant_id, code, name, resource_type, steps, is_active)
VALUES
(
  'f4000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'dpr_hq_prep_approval',
  'DPR Preparation Approval (HQ)',
  'dpr_proposal',
  '[{"order":1,"name":"HQ Need Assessment","role":"se","action":"review"},{"order":2,"name":"HQ Final Approval","role":"ce","action":"approve"}]'::jsonb,
  TRUE
),
(
  'f4000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'dpr_tac_round1',
  'TAC Review — First Round',
  'dpr_proposal',
  '[{"order":1,"name":"TAC Technical Review","role":"se","action":"review"},{"order":2,"name":"TAC Chair Clearance","role":"ce","action":"approve"}]'::jsonb,
  TRUE
),
(
  'f4000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000001',
  'dpr_tender_approval',
  'Tender Document Approval',
  'dpr_tender',
  '[{"order":1,"name":"JE Verification","role":"je","action":"verify"},{"order":2,"name":"AE Review","role":"ae","action":"review"},{"order":3,"name":"EE Approval","role":"ee","action":"approve"},{"order":4,"name":"HQ Technical","role":"se","action":"review"},{"order":5,"name":"Competent Authority","role":"ce","action":"approve"}]'::jsonb,
  TRUE
)
ON CONFLICT (id) DO NOTHING;
