-- BOQ auto-validation results for TAC fast review

CREATE TABLE IF NOT EXISTS dpr_boq_validations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    proposal_id         UUID NOT NULL REFERENCES dpr_proposals(id) ON DELETE CASCADE,
    document_id         UUID REFERENCES dpr_proposal_documents(id) ON DELETE SET NULL,
    file_name           VARCHAR(500),
    status              VARCHAR(30) NOT NULL DEFAULT 'pending',
    total_items         INT NOT NULL DEFAULT 0,
    passed_items        INT NOT NULL DEFAULT 0,
    failed_items        INT NOT NULL DEFAULT 0,
    warning_items       INT NOT NULL DEFAULT 0,
    computed_grand_total NUMERIC(16, 2),
    declared_grand_total NUMERIC(16, 2),
    grand_total_match   BOOLEAN,
    validation_report   JSONB NOT NULL DEFAULT '[]'::jsonb,
    summary             JSONB,
    validated_at        TIMESTAMPTZ DEFAULT NOW(),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dpr_boq_validation_proposal
  ON dpr_boq_validations(proposal_id, validated_at DESC);
