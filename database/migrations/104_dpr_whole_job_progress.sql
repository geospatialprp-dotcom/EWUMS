-- Multi-day DPR progress for "1 Job" BOQ items (cumulative % without duplicate counting)

ALTER TABLE boq_items
  ADD COLUMN IF NOT EXISTS measurement_mode VARCHAR(20) NOT NULL DEFAULT 'discrete_qty',
  ADD COLUMN IF NOT EXISTS dpr_execution_status VARCHAR(20) NOT NULL DEFAULT 'not_started';

UPDATE boq_items
SET measurement_mode = 'whole_job'
WHERE measurement_mode = 'discrete_qty'
  AND (
    unit ILIKE '%job%'
    OR unit ILIKE 'ls'
    OR unit ILIKE 'l.s.%'
    OR unit ILIKE 'item'
    OR unit ILIKE 'lump%sum%'
  );

UPDATE boq_items
SET dpr_execution_status = CASE
  WHEN dpr_qty >= COALESCE(NULLIF(revised_qty, 0), contract_qty) AND COALESCE(NULLIF(revised_qty, 0), contract_qty) > 0
    THEN 'completed'
  WHEN dpr_qty > 0 THEN 'in_progress'
  ELSE 'not_started'
END;

ALTER TABLE dpr_activities
  ADD COLUMN IF NOT EXISTS progress_mode VARCHAR(20) NOT NULL DEFAULT 'discrete_qty',
  ADD COLUMN IF NOT EXISTS progress_pct_today DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS cumulative_progress_pct DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS cumulative_qty DECIMAL(14,3),
  ADD COLUMN IF NOT EXISTS work_done_today TEXT,
  ADD COLUMN IF NOT EXISTS execution_scope_key VARCHAR(120);

CREATE TABLE IF NOT EXISTS dpr_boq_execution (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  boq_item_id             UUID NOT NULL REFERENCES boq_items(id) ON DELETE CASCADE,
  work_package_id         UUID REFERENCES work_packages(id) ON DELETE SET NULL,
  scope_key               VARCHAR(120) NOT NULL,
  chainage_from           VARCHAR(50),
  chainage_to             VARCHAR(50),
  measurement_mode        VARCHAR(20) NOT NULL DEFAULT 'discrete_qty',
  sanctioned_qty          DECIMAL(14,3) NOT NULL DEFAULT 1,
  cumulative_qty          DECIMAL(14,3) NOT NULL DEFAULT 0,
  cumulative_pct          DECIMAL(5,2) NOT NULL DEFAULT 0,
  status                  VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  started_on              DATE,
  completed_on            DATE,
  expected_completion_date DATE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, scope_key)
);

CREATE INDEX IF NOT EXISTS idx_dpr_boq_execution_boq
  ON dpr_boq_execution(project_id, boq_item_id, status);

CREATE TABLE IF NOT EXISTS dpr_boq_progress_ledger (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  project_id        UUID NOT NULL,
  dpr_id            UUID NOT NULL REFERENCES dpr_reports(id) ON DELETE CASCADE,
  dpr_activity_id   UUID NOT NULL REFERENCES dpr_activities(id) ON DELETE CASCADE,
  boq_item_id       UUID NOT NULL REFERENCES boq_items(id) ON DELETE CASCADE,
  scope_key         VARCHAR(120) NOT NULL,
  delta_qty         DECIMAL(14,3) NOT NULL,
  delta_pct         DECIMAL(5,2),
  applied_at        TIMESTAMPTZ DEFAULT NOW(),
  reversed_at       TIMESTAMPTZ,
  UNIQUE (dpr_activity_id)
);

CREATE INDEX IF NOT EXISTS idx_dpr_boq_ledger_dpr ON dpr_boq_progress_ledger(dpr_id);

-- Cap over-counted demo data where multiple "1 Job" DPRs stacked
UPDATE boq_items
SET dpr_qty = LEAST(
  dpr_qty,
  COALESCE(NULLIF(revised_qty, 0), contract_qty)
)
WHERE measurement_mode = 'whole_job';
