-- Auto-generated LA case documents
CREATE TABLE IF NOT EXISTS la_case_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    la_case_id      UUID NOT NULL REFERENCES la_cases(id) ON DELETE CASCADE,
    document_code   VARCHAR(80) NOT NULL,
    title           VARCHAR(500) NOT NULL,
    status          VARCHAR(30) NOT NULL DEFAULT 'generated'
        CHECK (status IN ('generated', 'draft', 'signed', 'submitted')),
    content_html    TEXT NOT NULL DEFAULT '',
    metadata        JSONB NOT NULL DEFAULT '{}',
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (la_case_id, document_code)
);

CREATE INDEX IF NOT EXISTS idx_la_case_documents_case ON la_case_documents(la_case_id);

ALTER TABLE la_case_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY la_case_documents_tenant ON la_case_documents
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
