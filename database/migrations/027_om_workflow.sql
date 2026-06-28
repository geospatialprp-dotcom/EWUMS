-- O&M Management workflow for water supply schemes (JJM / UJS / AMRUT)

INSERT INTO permissions (resource, action, description) VALUES
('om', 'read', 'View O&M records and dashboards'),
('om', 'create', 'Create O&M records'),
('om', 'update', 'Update O&M records'),
('om', 'submit', 'Submit O&M records for approval'),
('om', 'approve', 'Approve O&M workflow steps')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000001', id, 'organization'
FROM permissions WHERE resource = 'om'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000006', id, 'organization'
FROM permissions WHERE resource = 'om' AND action IN ('read', 'create', 'update', 'submit')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000007', id, 'organization'
FROM permissions WHERE resource = 'om' AND action IN ('read', 'approve', 'update')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000008', id, 'organization'
FROM permissions WHERE resource = 'om' AND action IN ('read', 'approve')
ON CONFLICT DO NOTHING;

-- Stage 1: Asset handover
CREATE TABLE IF NOT EXISTS om_handover (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    project_id              UUID REFERENCES projects(id) ON DELETE SET NULL,
    scheme_name             VARCHAR(255) NOT NULL,
    completion_verified     BOOLEAN DEFAULT FALSE,
    commissioning_verified  BOOLEAN DEFAULT FALSE,
    as_built_verified       BOOLEAN DEFAULT FALSE,
    gis_mapping_verified    BOOLEAN DEFAULT FALSE,
    asset_register_verified BOOLEAN DEFAULT FALSE,
    fhtc_verified           BOOLEAN DEFAULT FALSE,
    om_manual_verified      BOOLEAN DEFAULT FALSE,
    handover_certificate_url VARCHAR(500),
    om_agency_type          VARCHAR(50),
    om_agency_name          VARCHAR(255),
    responsibility_matrix   JSONB DEFAULT '{}',
    status                  VARCHAR(50) DEFAULT 'draft',
    workflow_instance_id    UUID REFERENCES workflow_instances(id),
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_om_handover_tenant ON om_handover(tenant_id);
CREATE INDEX IF NOT EXISTS idx_om_handover_project ON om_handover(project_id);

-- Stage 5: Breakdown tickets
CREATE TABLE IF NOT EXISTS om_breakdown_tickets (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    project_id              UUID REFERENCES projects(id) ON DELETE SET NULL,
    asset_id                UUID REFERENCES assets(id) ON DELETE SET NULL,
    ticket_no               VARCHAR(50) NOT NULL,
    category                VARCHAR(50) NOT NULL,
    title                   VARCHAR(255) NOT NULL,
    description             TEXT,
    status                  VARCHAR(50) DEFAULT 'open',
    priority                VARCHAR(20) DEFAULT 'medium',
    latitude                DOUBLE PRECISION,
    longitude               DOUBLE PRECISION,
    assigned_to             UUID REFERENCES users(id),
    response_time_mins      INTEGER,
    repair_details          TEXT,
    materials_used          JSONB DEFAULT '[]',
    labour_used             JSONB DEFAULT '[]',
    before_photo_url        VARCHAR(500),
    after_photo_url         VARCHAR(500),
    workflow_instance_id    UUID REFERENCES workflow_instances(id),
    reported_by             UUID REFERENCES users(id),
    closed_at               TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_om_breakdown_ticket_no ON om_breakdown_tickets(tenant_id, ticket_no);
CREATE INDEX IF NOT EXISTS idx_om_breakdown_status ON om_breakdown_tickets(tenant_id, status);

-- Stage 6: Water quality tests
CREATE TABLE IF NOT EXISTS om_water_quality_tests (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    project_id              UUID REFERENCES projects(id) ON DELETE SET NULL,
    asset_id                UUID REFERENCES assets(id) ON DELETE SET NULL,
    sample_point            VARCHAR(50) NOT NULL,
    sample_date             TIMESTAMPTZ NOT NULL,
    parameters              JSONB DEFAULT '{}',
    is_compliant            BOOLEAN,
    lab_name                VARCHAR(255),
    result_notes            TEXT,
    latitude                DOUBLE PRECISION,
    longitude               DOUBLE PRECISION,
    corrective_action       TEXT,
    status                  VARCHAR(50) DEFAULT 'pending',
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_om_wq_tenant_date ON om_water_quality_tests(tenant_id, sample_date DESC);

-- Stage 7: Energy readings
CREATE TABLE IF NOT EXISTS om_energy_readings (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    project_id              UUID REFERENCES projects(id) ON DELETE SET NULL,
    asset_id                UUID REFERENCES assets(id) ON DELETE SET NULL,
    reading_date            DATE NOT NULL,
    pump_running_hours      DECIMAL(10,2),
    energy_kwh              DECIMAL(12,3),
    energy_cost             DECIMAL(12,2),
    water_pumped_kl         DECIMAL(12,3),
    power_factor            DECIMAL(5,3),
    pump_efficiency_pct     DECIMAL(5,2),
    notes                   TEXT,
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_om_energy_tenant_date ON om_energy_readings(tenant_id, reading_date DESC);

-- Stage 10: Consumer complaints
CREATE TABLE IF NOT EXISTS om_consumer_complaints (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    complaint_no            VARCHAR(50) NOT NULL,
    consumer_id             VARCHAR(100),
    fhtc_number             VARCHAR(100),
    mobile                  VARCHAR(20),
    village                 VARCHAR(255),
    complaint_type          VARCHAR(50) NOT NULL,
    channel                 VARCHAR(30) DEFAULT 'web',
    description             TEXT,
    status                  VARCHAR(50) DEFAULT 'registered',
    latitude                DOUBLE PRECISION,
    longitude               DOUBLE PRECISION,
    assigned_to             UUID REFERENCES users(id),
    resolution_notes        TEXT,
    consumer_feedback       TEXT,
    workflow_instance_id    UUID REFERENCES workflow_instances(id),
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    closed_at               TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_om_complaint_no ON om_consumer_complaints(tenant_id, complaint_no);

-- Workflow definitions
INSERT INTO workflow_definitions (id, tenant_id, code, name, resource_type, steps, is_active)
VALUES (
    'f3000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'om_breakdown',
    'O&M Breakdown Ticket',
    'om_breakdown_ticket',
    '[
      {"order":1,"name":"Site Inspection","role":"je","action":"inspect"},
      {"order":2,"name":"Repair Execution","role":"contractor","action":"repair"},
      {"order":3,"name":"Verification","role":"ae","action":"verify"},
      {"order":4,"name":"Closure","role":"ee","action":"close"}
    ]'::jsonb,
    TRUE
),
(
    'f3000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'om_handover',
    'O&M Asset Handover',
    'om_handover',
    '[
      {"order":1,"name":"JE Verification","role":"je","action":"verify"},
      {"order":2,"name":"AE Approval","role":"ae","action":"approve"},
      {"order":3,"name":"EE Handover","role":"ee","action":"handover"}
    ]'::jsonb,
    TRUE
)
ON CONFLICT (id) DO NOTHING;
