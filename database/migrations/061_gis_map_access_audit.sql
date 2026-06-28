-- GIS Map Explorer — role-based access audit trail

CREATE TABLE IF NOT EXISTS gis_map_access_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    user_role       VARCHAR(50),
    division_id     UUID REFERENCES divisions(id) ON DELETE SET NULL,
    division_name   VARCHAR(255),
    access_scope    VARCHAR(30),
    action          VARCHAR(80) NOT NULL,
    layer_id        UUID,
    layer_name      VARCHAR(255),
    project_id      UUID,
    details         JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gis_map_access_logs_tenant ON gis_map_access_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gis_map_access_logs_user ON gis_map_access_logs(user_id, created_at DESC);
