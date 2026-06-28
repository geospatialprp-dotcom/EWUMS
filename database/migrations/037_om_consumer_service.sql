-- Stage 9: Consumer Service Management

CREATE TABLE IF NOT EXISTS om_consumers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
    consumer_code       VARCHAR(50) NOT NULL,
    fhtc_number         VARCHAR(100) NOT NULL,
    consumer_name       VARCHAR(255),
    mobile              VARCHAR(20),
    village             VARCHAR(255),
    latitude            DOUBLE PRECISION,
    longitude           DOUBLE PRECISION,
    meter_number        VARCHAR(100),
    meter_type          VARCHAR(50),
    meter_install_date  DATE,
    connection_status   VARCHAR(30) DEFAULT 'active',
    notes               TEXT,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS om_consumer_service_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    consumer_id         UUID NOT NULL REFERENCES om_consumers(id) ON DELETE CASCADE,
    request_no          VARCHAR(50) NOT NULL,
    request_type        VARCHAR(50) NOT NULL,
    status              VARCHAR(30) DEFAULT 'requested',
    details             JSONB NOT NULL DEFAULT '{}',
    notes               TEXT,
    created_by          UUID REFERENCES users(id),
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_om_consumers_code ON om_consumers(tenant_id, consumer_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_om_consumers_fhtc ON om_consumers(tenant_id, fhtc_number);
CREATE INDEX IF NOT EXISTS idx_om_consumers_village ON om_consumers(tenant_id, village);
CREATE INDEX IF NOT EXISTS idx_om_consumer_requests ON om_consumer_service_requests(tenant_id, consumer_id);
