-- DPR PDF Review & Redline Correction — Phase 1 foundation

CREATE TABLE IF NOT EXISTS dpr_pdf_reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    proposal_id     UUID NOT NULL REFERENCES dpr_proposals(id) ON DELETE CASCADE,
    document_id     UUID NOT NULL REFERENCES dpr_proposal_documents(id) ON DELETE CASCADE,
    status          VARCHAR(40) NOT NULL DEFAULT 'open',
    reviewer_scope  VARCHAR(30) NOT NULL DEFAULT 'division',
    assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dpr_pdf_reviews_doc
    ON dpr_pdf_reviews(tenant_id, proposal_id, document_id);
CREATE INDEX IF NOT EXISTS idx_dpr_pdf_reviews_proposal
    ON dpr_pdf_reviews(tenant_id, proposal_id);

CREATE TABLE IF NOT EXISTS dpr_pdf_annotations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    review_id       UUID NOT NULL REFERENCES dpr_pdf_reviews(id) ON DELETE CASCADE,
    proposal_id     UUID NOT NULL REFERENCES dpr_proposals(id) ON DELETE CASCADE,
    document_id     UUID NOT NULL REFERENCES dpr_proposal_documents(id) ON DELETE CASCADE,
    page_number     INT NOT NULL,
    annotation_type VARCHAR(40) NOT NULL,
    geometry        JSONB NOT NULL DEFAULT '{}',
    color           VARCHAR(20) NOT NULL DEFAULT '#e53935',
    content         TEXT,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dpr_pdf_annotations_review
    ON dpr_pdf_annotations(review_id, page_number);
CREATE INDEX IF NOT EXISTS idx_dpr_pdf_annotations_proposal
    ON dpr_pdf_annotations(tenant_id, proposal_id, document_id);

CREATE TABLE IF NOT EXISTS dpr_pdf_comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    review_id       UUID NOT NULL REFERENCES dpr_pdf_reviews(id) ON DELETE CASCADE,
    annotation_id   UUID REFERENCES dpr_pdf_annotations(id) ON DELETE SET NULL,
    proposal_id     UUID NOT NULL REFERENCES dpr_proposals(id) ON DELETE CASCADE,
    page_number     INT,
    body            TEXT NOT NULL,
    parent_id       UUID REFERENCES dpr_pdf_comments(id) ON DELETE CASCADE,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dpr_pdf_comments_review
    ON dpr_pdf_comments(review_id, created_at DESC);

CREATE TABLE IF NOT EXISTS dpr_pdf_versions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    review_id               UUID NOT NULL REFERENCES dpr_pdf_reviews(id) ON DELETE CASCADE,
    proposal_id             UUID NOT NULL REFERENCES dpr_proposals(id) ON DELETE CASCADE,
    document_id             UUID NOT NULL REFERENCES dpr_proposal_documents(id) ON DELETE CASCADE,
    version_no              INT NOT NULL DEFAULT 1,
    label                   VARCHAR(255),
    snapshot_annotations    JSONB,
    created_by              UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dpr_pdf_versions_review
    ON dpr_pdf_versions(review_id, version_no DESC);

-- Permissions
INSERT INTO permissions (resource, action, description) VALUES
  ('dpr_pdf_review', 'read', 'View DPR PDF review sessions and annotations'),
  ('dpr_pdf_review', 'annotate', 'Create and edit PDF redline annotations'),
  ('dpr_pdf_review', 'comment', 'Add discussion comments on PDF review')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'organization'
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND p.resource = 'dpr_pdf_review'
  AND r.code IN ('super_admin', 'ee', 'se', 'ce', 'cgm', 'md', 'je', 'ae')
ON CONFLICT DO NOTHING;
