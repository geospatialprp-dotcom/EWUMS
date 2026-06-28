-- Stage 3: Routine Inspection Management (daily / weekly / monthly)

CREATE TABLE IF NOT EXISTS om_inspections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
    asset_id            UUID REFERENCES assets(id) ON DELETE SET NULL,
    inspection_type     VARCHAR(20) NOT NULL,
    performed_by_role   VARCHAR(50) NOT NULL,
    performed_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    inspection_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status              VARCHAR(50) DEFAULT 'submitted',
    latitude            DOUBLE PRECISION,
    longitude           DOUBLE PRECISION,
    checklist           JSONB NOT NULL DEFAULT '{}',
    photos              JSONB NOT NULL DEFAULT '[]',
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_om_inspections_tenant ON om_inspections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_om_inspections_project ON om_inspections(project_id);
CREATE INDEX IF NOT EXISTS idx_om_inspections_type ON om_inspections(tenant_id, inspection_type);
CREATE INDEX IF NOT EXISTS idx_om_inspections_date ON om_inspections(tenant_id, inspection_date DESC);
