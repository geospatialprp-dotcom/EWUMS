-- Stage 2: HQ DPR Preparation Approval — verification checklist & preparation order

ALTER TABLE dpr_proposals
  ADD COLUMN IF NOT EXISTS hq_verification JSONB,
  ADD COLUMN IF NOT EXISTS hq_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hq_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dpr_prep_order_no VARCHAR(100),
  ADD COLUMN IF NOT EXISTS dpr_prep_order_issued_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_dpr_proposals_hq_review
  ON dpr_proposals(tenant_id, status)
  WHERE status IN ('hq_review', 'proposal_submitted');
