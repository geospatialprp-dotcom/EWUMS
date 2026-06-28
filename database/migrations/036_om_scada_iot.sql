-- Stage 8: SCADA & IoT integration — telemetry and automated alerts

CREATE TABLE IF NOT EXISTS om_scada_readings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
    asset_id            UUID REFERENCES assets(id) ON DELETE SET NULL,
    site_category       VARCHAR(30) NOT NULL,
    metric_key          VARCHAR(50) NOT NULL,
    value_numeric       DOUBLE PRECISION,
    value_text          VARCHAR(100),
    unit                VARCHAR(30),
    source              VARCHAR(30) DEFAULT 'scada',
    recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS om_scada_alerts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
    asset_id            UUID REFERENCES assets(id) ON DELETE SET NULL,
    alert_type          VARCHAR(50) NOT NULL,
    severity            VARCHAR(20) NOT NULL DEFAULT 'warning',
    message             TEXT NOT NULL,
    metric_key          VARCHAR(50),
    metric_value        DOUBLE PRECISION,
    status              VARCHAR(30) DEFAULT 'open',
    acknowledged_at     TIMESTAMPTZ,
    resolved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_om_scada_readings_tenant ON om_scada_readings(tenant_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_om_scada_readings_category ON om_scada_readings(tenant_id, site_category, metric_key);
CREATE INDEX IF NOT EXISTS idx_om_scada_alerts_tenant ON om_scada_alerts(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_om_scada_alerts_type ON om_scada_alerts(tenant_id, alert_type);
