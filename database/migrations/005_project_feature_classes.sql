-- Project feature classes (point / line / polygon layers with custom attribute schema)
CREATE TABLE project_feature_classes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    code            VARCHAR(100) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    geometry_type   VARCHAR(20) NOT NULL CHECK (geometry_type IN ('Point', 'LineString', 'Polygon')),
    attribute_schema JSONB NOT NULL DEFAULT '[]',
    default_style   JSONB NOT NULL DEFAULT '{}',
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, code)
);

CREATE INDEX idx_project_feature_classes_project ON project_feature_classes(project_id);
CREATE INDEX idx_project_feature_classes_tenant ON project_feature_classes(tenant_id);

-- Features inside a feature class (geometry + attribute values as JSONB)
CREATE TABLE project_features (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    feature_class_id  UUID NOT NULL REFERENCES project_feature_classes(id) ON DELETE CASCADE,
    geometry          GEOMETRY(Geometry, 4326),
    attributes        JSONB NOT NULL DEFAULT '{}',
    created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_features_class ON project_features(feature_class_id);
CREATE INDEX idx_project_features_project ON project_features(project_id);
CREATE INDEX idx_project_features_geom ON project_features USING GIST(geometry);

ALTER TABLE project_feature_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_feature_classes_tenant_isolation ON project_feature_classes
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY project_features_tenant_isolation ON project_features
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
