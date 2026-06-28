-- Stage 4: Preventive Maintenance Management (auto-generated PM schedules)

CREATE TABLE IF NOT EXISTS om_pm_schedules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    asset_id            UUID REFERENCES assets(id) ON DELETE SET NULL,
    category            VARCHAR(30) NOT NULL,
    task_code           VARCHAR(80) NOT NULL,
    task_name           VARCHAR(200) NOT NULL,
    frequency           VARCHAR(20) NOT NULL,
    period_key          VARCHAR(20) NOT NULL,
    scheduled_for       DATE NOT NULL,
    due_date            DATE NOT NULL,
    status              VARCHAR(30) DEFAULT 'scheduled',
    completed_at        TIMESTAMPTZ,
    completed_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_om_pm_schedules_tenant ON om_pm_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_om_pm_schedules_project ON om_pm_schedules(project_id);
CREATE INDEX IF NOT EXISTS idx_om_pm_schedules_due ON om_pm_schedules(tenant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_om_pm_schedules_category ON om_pm_schedules(tenant_id, category, frequency);
CREATE UNIQUE INDEX IF NOT EXISTS idx_om_pm_schedules_unique
    ON om_pm_schedules(tenant_id, project_id, COALESCE(asset_id, '00000000-0000-0000-0000-000000000000'::uuid), task_code, period_key);
