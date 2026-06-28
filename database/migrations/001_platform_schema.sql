-- EGIP Platform Schema
-- PostgreSQL 16 + PostGIS 3.4

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- PLATFORM TABLES
-- ============================================================

CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(63) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    industry_pack   VARCHAR(50),
    tier            VARCHAR(20) DEFAULT 'enterprise',
    settings        JSONB DEFAULT '{}',
    status          VARCHAR(20) DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE permissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource        VARCHAR(100) NOT NULL,
    action          VARCHAR(50) NOT NULL,
    description     VARCHAR(255),
    UNIQUE(resource, action)
);

CREATE TABLE roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
    code            VARCHAR(100) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    is_system       BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

CREATE TABLE role_permissions (
    role_id         UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   UUID REFERENCES permissions(id) ON DELETE CASCADE,
    scope           VARCHAR(50) DEFAULT 'organization',
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    first_name      VARCHAR(100),
    last_name       VARCHAR(100),
    department      VARCHAR(100),
    status          VARCHAR(20) DEFAULT 'active',
    mfa_enabled     BOOLEAN DEFAULT FALSE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

CREATE TABLE user_roles (
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id         UUID REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at     TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    user_id         UUID REFERENCES users(id),
    action          VARCHAR(100) NOT NULL,
    resource_type   VARCHAR(100),
    resource_id     UUID,
    details         JSONB DEFAULT '{}',
    ip_address      INET,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant_time ON audit_logs(tenant_id, created_at DESC);

-- ============================================================
-- ASSET MANAGEMENT
-- ============================================================

CREATE TABLE asset_types (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
    industry_module VARCHAR(50),
    code            VARCHAR(100) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    geometry_type   VARCHAR(20) DEFAULT 'Point',
    attribute_schema JSONB DEFAULT '{}',
    icon            VARCHAR(255),
    default_style   JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

CREATE TABLE assets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    asset_code      VARCHAR(100) NOT NULL,
    asset_type_id   UUID NOT NULL REFERENCES asset_types(id),
    name            VARCHAR(500),
    status          VARCHAR(50) DEFAULT 'active',
    health_score    SMALLINT DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
    geometry        GEOMETRY(Geometry, 4326),
    attributes      JSONB DEFAULT '{}',
    qr_code         VARCHAR(255),
    rfid_tag        VARCHAR(255),
    lifecycle_stage VARCHAR(50) DEFAULT 'operational',
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE(tenant_id, asset_code)
);

CREATE INDEX idx_assets_geom ON assets USING GIST(geometry);
CREATE INDEX idx_assets_tenant ON assets(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assets_type ON assets(asset_type_id);
CREATE INDEX idx_assets_status ON assets(tenant_id, status);

CREATE TABLE asset_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id        UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    file_type       VARCHAR(50),
    file_url        VARCHAR(500),
    uploaded_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inspections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    asset_id        UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    inspector_id    UUID REFERENCES users(id),
    inspection_date TIMESTAMPTZ DEFAULT NOW(),
    status          VARCHAR(50) DEFAULT 'completed',
    findings        JSONB DEFAULT '{}',
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE maintenance_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    asset_id        UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    maintenance_type VARCHAR(50),
    scheduled_date  DATE,
    completed_date  DATE,
    cost            DECIMAL(12,2),
    notes           TEXT,
    status          VARCHAR(50) DEFAULT 'scheduled',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GIS LAYER CATALOG
-- ============================================================

CREATE TABLE gis_layer_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    sort_order      INT DEFAULT 0,
    is_expanded     BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE gis_layers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    layer_group_id  UUID REFERENCES gis_layer_groups(id) ON DELETE SET NULL,
    name            VARCHAR(255) NOT NULL,
    source_type     VARCHAR(50) NOT NULL,
    source_config   JSONB DEFAULT '{}',
    default_style   JSONB DEFAULT '{}',
    min_zoom        INT DEFAULT 0,
    max_zoom        INT DEFAULT 22,
    is_public       BOOLEAN DEFAULT FALSE,
    is_published    BOOLEAN DEFAULT FALSE,
    ogc_endpoint    VARCHAR(500),
    sort_order      INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROJECTS
-- ============================================================

CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_code    VARCHAR(100) NOT NULL,
    name            VARCHAR(500) NOT NULL,
    description     TEXT,
    status          VARCHAR(50) DEFAULT 'active',
    start_date      DATE,
    end_date        DATE,
    budget          DECIMAL(14,2),
    spent           DECIMAL(14,2) DEFAULT 0,
    physical_progress DECIMAL(5,2) DEFAULT 0,
    financial_progress DECIMAL(5,2) DEFAULT 0,
    geometry        GEOMETRY(Polygon, 4326),
    manager_id      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, project_code)
);

CREATE TABLE project_milestones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    due_date        DATE,
    completed_date  DATE,
    status          VARCHAR(50) DEFAULT 'pending',
    progress        DECIMAL(5,2) DEFAULT 0,
    sort_order      INT DEFAULT 0
);

-- ============================================================
-- IoT
-- ============================================================

CREATE TABLE iot_devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    asset_id        UUID REFERENCES assets(id) ON DELETE SET NULL,
    device_code     VARCHAR(100) NOT NULL,
    name            VARCHAR(255),
    device_type     VARCHAR(100),
    status          VARCHAR(50) DEFAULT 'active',
    location        GEOMETRY(Point, 4326),
    config          JSONB DEFAULT '{}',
    last_seen_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, device_code)
);

CREATE TABLE iot_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    device_id       UUID NOT NULL REFERENCES iot_devices(id) ON DELETE CASCADE,
    severity        VARCHAR(20) NOT NULL,
    message         TEXT NOT NULL,
    metric          VARCHAR(100),
    value           DOUBLE PRECISION,
    acknowledged    BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE gis_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY assets_tenant_isolation ON assets
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY gis_layers_tenant_isolation ON gis_layers
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY projects_tenant_isolation ON projects
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);
