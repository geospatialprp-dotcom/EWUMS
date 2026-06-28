-- Stage 12: Asset Lifecycle & Renewal Management

CREATE TABLE IF NOT EXISTS om_asset_lifecycle_assessments (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    asset_id                    UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    project_id                  UUID REFERENCES projects(id),
    assessment_date             DATE NOT NULL,
    condition_grade             VARCHAR(30) NOT NULL,
    health_index                SMALLINT NOT NULL,
    remaining_useful_life_years NUMERIC(6, 2),
    condition_notes             TEXT,
    assessed_by                 UUID REFERENCES users(id),
    created_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_om_lifecycle_assess_asset ON om_asset_lifecycle_assessments(asset_id, assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_om_lifecycle_assess_tenant ON om_asset_lifecycle_assessments(tenant_id);

CREATE TABLE IF NOT EXISTS om_renewal_plans (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    project_id                  UUID REFERENCES projects(id),
    asset_id                    UUID REFERENCES assets(id) ON DELETE SET NULL,
    lifecycle_category          VARCHAR(50) NOT NULL,
    plan_no                     VARCHAR(50) NOT NULL,
    plan_type                   VARCHAR(30) NOT NULL,
    plan_year                   SMALLINT,
    title                       VARCHAR(255) NOT NULL,
    description                 TEXT,
    health_index_at_plan        SMALLINT,
    remaining_useful_life_years NUMERIC(6, 2),
    estimated_cost              NUMERIC(14, 2),
    priority                    VARCHAR(20) DEFAULT 'medium',
    status                      VARCHAR(30) DEFAULT 'draft',
    target_date                 DATE,
    created_by                  UUID REFERENCES users(id),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_om_renewal_plan_no ON om_renewal_plans(tenant_id, plan_no);
CREATE INDEX IF NOT EXISTS idx_om_renewal_plans_project ON om_renewal_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_om_renewal_plans_type ON om_renewal_plans(tenant_id, plan_type, plan_year);
