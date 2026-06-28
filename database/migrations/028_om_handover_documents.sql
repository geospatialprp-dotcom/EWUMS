-- O&M Stage 1: Electronic handover document repository (e-DMS)

CREATE TABLE IF NOT EXISTS om_handover_documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    handover_id         UUID NOT NULL REFERENCES om_handover(id) ON DELETE CASCADE,
    doc_type            VARCHAR(50) NOT NULL,
    title               VARCHAR(255) NOT NULL,
    file_name           VARCHAR(500),
    file_url            TEXT,
    source              VARCHAR(30) DEFAULT 'upload',
    status              VARCHAR(30) DEFAULT 'pending',
    uploaded_by         UUID REFERENCES users(id),
    uploaded_at         TIMESTAMPTZ DEFAULT NOW(),
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    approval_comments   TEXT,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_om_handover_docs_handover ON om_handover_documents(handover_id);
