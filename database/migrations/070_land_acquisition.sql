-- Land Acquisition Management (LAM) — GIS-integrated parcel & clearance workflow

CREATE TABLE IF NOT EXISTS la_cases (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id              UUID REFERENCES projects(id) ON DELETE SET NULL,
    dpr_proposal_id         UUID REFERENCES dpr_proposals(id) ON DELETE SET NULL,
    division_id             UUID REFERENCES divisions(id) ON DELETE SET NULL,
    case_no                 VARCHAR(50) NOT NULL,
    title                   VARCHAR(500) NOT NULL,
    scheme_type             VARCHAR(30) NOT NULL DEFAULT 'gravity'
        CHECK (scheme_type IN ('gravity', 'pumping', 'sewer', 'combined', 'transmission', 'distribution')),
    infrastructure_summary  JSONB NOT NULL DEFAULT '{}',
    status                  VARCHAR(50) NOT NULL DEFAULT 'draft',
    total_parcels           INT NOT NULL DEFAULT 0,
    total_area_sqm          DECIMAL(14, 2) NOT NULL DEFAULT 0,
    total_compensation_est  DECIMAL(14, 2) NOT NULL DEFAULT 0,
    clearance_status        VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (clearance_status IN ('pending', 'partial', 'cleared', 'blocked')),
    possession_status       VARCHAR(30) NOT NULL DEFAULT 'none'
        CHECK (possession_status IN ('none', 'partial', 'complete')),
    created_by              UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, case_no)
);

CREATE INDEX IF NOT EXISTS idx_la_cases_tenant ON la_cases(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_la_cases_division ON la_cases(tenant_id, division_id);
CREATE INDEX IF NOT EXISTS idx_la_cases_project ON la_cases(project_id);
CREATE INDEX IF NOT EXISTS idx_la_cases_dpr ON la_cases(dpr_proposal_id);

CREATE TABLE IF NOT EXISTS la_alignment_segments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    la_case_id          UUID NOT NULL REFERENCES la_cases(id) ON DELETE CASCADE,
    project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
    feature_id          UUID REFERENCES project_features(id) ON DELETE SET NULL,
    component           VARCHAR(80),
    asset_type          VARCHAR(80),
    chainage_from       VARCHAR(50),
    chainage_to         VARCHAR(50),
    row_width_m         DECIMAL(8, 2) NOT NULL DEFAULT 6,
    diameter_mm         INT,
    geometry            GEOMETRY(Geometry, 4326),
    corridor_geometry   GEOMETRY(Geometry, 4326),
    status              VARCHAR(30) NOT NULL DEFAULT 'traced',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_la_alignments_case ON la_alignment_segments(la_case_id);
CREATE INDEX IF NOT EXISTS idx_la_alignments_geom ON la_alignment_segments USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_la_alignments_corridor ON la_alignment_segments USING GIST(corridor_geometry);

CREATE TABLE IF NOT EXISTS la_parcels (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    la_case_id              UUID NOT NULL REFERENCES la_cases(id) ON DELETE CASCADE,
    source_feature_id       UUID REFERENCES project_features(id) ON DELETE SET NULL,
    village                 VARCHAR(255),
    tehsil                  VARCHAR(255),
    district                VARCHAR(255),
    khasra_no               VARCHAR(100),
    khata_no                VARCHAR(100),
    land_use                VARCHAR(80),
    land_class              VARCHAR(80),
    total_area_sqm          DECIMAL(14, 2),
    affected_area_sqm       DECIMAL(14, 2),
    affected_length_m       DECIMAL(14, 2),
    circle_rate_per_sqm     DECIMAL(14, 2),
    acquisition_mode        VARCHAR(30) NOT NULL DEFAULT 'easement'
        CHECK (acquisition_mode IN ('full', 'partial', 'easement', 'temporary')),
    geometry                GEOMETRY(Geometry, 4326),
    intersection_geometry   GEOMETRY(Geometry, 4326),
    attributes              JSONB NOT NULL DEFAULT '{}',
    status                  VARCHAR(30) NOT NULL DEFAULT 'identified'
        CHECK (status IN ('identified', 'surveyed', 'notified', 'awarded', 'paid', 'possession')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_la_parcels_case ON la_parcels(la_case_id, status);
CREATE INDEX IF NOT EXISTS idx_la_parcels_geom ON la_parcels USING GIST(geometry);

CREATE TABLE IF NOT EXISTS la_parcel_owners (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    la_parcel_id        UUID NOT NULL REFERENCES la_parcels(id) ON DELETE CASCADE,
    owner_name          VARCHAR(255) NOT NULL,
    relation            VARCHAR(80),
    share_pct           DECIMAL(5, 2) NOT NULL DEFAULT 100,
    contact             VARCHAR(100),
    verification_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    is_primary          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_la_owners_parcel ON la_parcel_owners(la_parcel_id);

CREATE TABLE IF NOT EXISTS la_clearance_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    la_case_id      UUID NOT NULL REFERENCES la_cases(id) ON DELETE CASCADE,
    la_parcel_id    UUID REFERENCES la_parcels(id) ON DELETE SET NULL,
    clearance_type  VARCHAR(80) NOT NULL,
    authority       VARCHAR(255),
    status          VARCHAR(30) NOT NULL DEFAULT 'required'
        CHECK (status IN ('required', 'applied', 'approved', 'rejected', 'not_applicable')),
    reference_no    VARCHAR(100),
    notes           TEXT,
    applied_at      TIMESTAMPTZ,
    approved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_la_clearances_case ON la_clearance_items(la_case_id, status);

CREATE TABLE IF NOT EXISTS la_compensation_schedules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    la_case_id          UUID NOT NULL REFERENCES la_cases(id) ON DELETE CASCADE,
    la_parcel_id        UUID NOT NULL REFERENCES la_parcels(id) ON DELETE CASCADE,
    owner_id            UUID REFERENCES la_parcel_owners(id) ON DELETE SET NULL,
    market_value        DECIMAL(14, 2) NOT NULL DEFAULT 0,
    solatium_amount     DECIMAL(14, 2) NOT NULL DEFAULT 0,
    structure_value     DECIMAL(14, 2) NOT NULL DEFAULT 0,
    trees_crops_value   DECIMAL(14, 2) NOT NULL DEFAULT 0,
    rr_entitlements     JSONB NOT NULL DEFAULT '{}',
    total_award         DECIMAL(14, 2) NOT NULL DEFAULT 0,
    paid_amount         DECIMAL(14, 2) NOT NULL DEFAULT 0,
    payment_status      VARCHAR(30) NOT NULL DEFAULT 'pending',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_la_compensation_case ON la_compensation_schedules(la_case_id);

CREATE TABLE IF NOT EXISTS la_workflow_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    la_case_id  UUID NOT NULL REFERENCES la_cases(id) ON DELETE CASCADE,
    stage       VARCHAR(50) NOT NULL,
    action      VARCHAR(80) NOT NULL,
    actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    remarks     TEXT,
    payload     JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_la_events_case ON la_workflow_events(la_case_id, created_at DESC);

ALTER TABLE la_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE la_alignment_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE la_parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE la_parcel_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE la_clearance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE la_compensation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE la_workflow_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY la_cases_tenant ON la_cases
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY la_alignments_tenant ON la_alignment_segments
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY la_parcels_tenant ON la_parcels
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY la_owners_tenant ON la_parcel_owners
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY la_clearances_tenant ON la_clearance_items
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY la_compensation_tenant ON la_compensation_schedules
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY la_events_tenant ON la_workflow_events
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

INSERT INTO permissions (resource, action, description) VALUES
  ('la_case', 'read', 'View land acquisition cases and maps'),
  ('la_case', 'create', 'Create and trace land acquisition cases'),
  ('la_case', 'update', 'Update parcels, clearances, and compensation'),
  ('la_case', 'approve', 'Advance LA workflow and approve clearances')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'organization'
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND p.resource = 'la_case'
  AND r.code IN ('super_admin', 'ee', 'se', 'ce', 'cgm', 'md', 'je', 'ae')
ON CONFLICT DO NOTHING;
