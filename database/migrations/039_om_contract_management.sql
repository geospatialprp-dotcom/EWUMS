-- Stage 11: O&M Contract Management

CREATE TABLE IF NOT EXISTS om_contracts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    project_id          UUID REFERENCES projects(id),
    contract_code       VARCHAR(50) NOT NULL,
    contractor_name     VARCHAR(255) NOT NULL,
    contractor_contact  VARCHAR(100),
    contract_type       VARCHAR(50) DEFAULT 'om_operations',
    start_date          DATE NOT NULL,
    end_date            DATE,
    status              VARCHAR(30) DEFAULT 'active',
    sla_targets         JSONB DEFAULT '{}',
    notes               TEXT,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_om_contract_code ON om_contracts(tenant_id, contract_code);
CREATE INDEX IF NOT EXISTS idx_om_contracts_project ON om_contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_om_contracts_status ON om_contracts(tenant_id, status);

CREATE TABLE IF NOT EXISTS om_contract_attendance (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    contract_id         UUID NOT NULL REFERENCES om_contracts(id) ON DELETE CASCADE,
    attendance_date     DATE NOT NULL,
    staff_required      INT NOT NULL DEFAULT 0,
    staff_present       INT NOT NULL DEFAULT 0,
    notes               TEXT,
    recorded_by         UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(contract_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_om_contract_attendance_contract ON om_contract_attendance(contract_id, attendance_date DESC);

CREATE TABLE IF NOT EXISTS om_contract_kpi_entries (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    contract_id                 UUID NOT NULL REFERENCES om_contracts(id) ON DELETE CASCADE,
    period_month                DATE NOT NULL,
    water_supply_hours_per_day  NUMERIC(6, 2),
    pump_availability_pct       NUMERIC(5, 2),
    nrw_pct                     NUMERIC(5, 2),
    notes                       TEXT,
    recorded_by                 UUID REFERENCES users(id),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(contract_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_om_contract_kpi_contract ON om_contract_kpi_entries(contract_id, period_month DESC);

CREATE TABLE IF NOT EXISTS om_contract_reviews (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    contract_id         UUID NOT NULL REFERENCES om_contracts(id) ON DELETE CASCADE,
    review_date         DATE NOT NULL,
    overall_rating      VARCHAR(30) NOT NULL,
    sla_compliance_pct  NUMERIC(5, 2),
    notes               TEXT,
    reviewed_by         UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_om_contract_reviews_contract ON om_contract_reviews(contract_id, review_date DESC);
