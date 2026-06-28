-- EGIP Workflow Engine
-- Approval workflows for assets, layers, projects, and user provisioning

CREATE TABLE workflow_definitions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code            VARCHAR(100) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    resource_type   VARCHAR(100) NOT NULL,
    description     TEXT,
    steps           JSONB NOT NULL DEFAULT '[]',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

CREATE TABLE workflow_instances (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    definition_id   UUID NOT NULL REFERENCES workflow_definitions(id),
    resource_type   VARCHAR(100) NOT NULL,
    resource_id     UUID,
    title           VARCHAR(500) NOT NULL,
    status          VARCHAR(50) DEFAULT 'pending',
    current_step    INT DEFAULT 1,
    payload         JSONB DEFAULT '{}',
    submitted_by    UUID REFERENCES users(id),
    submitted_at    TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_instances_tenant ON workflow_instances(tenant_id, status);
CREATE INDEX idx_workflow_instances_submitter ON workflow_instances(submitted_by);

CREATE TABLE workflow_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id     UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    step_order      INT NOT NULL,
    step_name       VARCHAR(255),
    assigned_role   VARCHAR(100) NOT NULL,
    assignee_id     UUID REFERENCES users(id),
    status          VARCHAR(50) DEFAULT 'pending',
    comments        TEXT,
    acted_by        UUID REFERENCES users(id),
    acted_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_tasks_pending ON workflow_tasks(assigned_role, status) WHERE status = 'pending';

-- Seed workflow definitions for demo tenant
INSERT INTO workflow_definitions (id, tenant_id, code, name, resource_type, description, steps) VALUES
('f1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
 'asset_create', 'Asset Creation Approval', 'asset',
 'New assets require GIS Administrator review before publishing to the map.',
 '[{"order":1,"name":"GIS Review","role":"gis_admin","action":"review"},{"order":2,"name":"Final Approval","role":"super_admin","action":"approve"}]'),
('f1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
 'layer_publish', 'Layer Publish Approval', 'layer',
 'GIS layers must be reviewed before publishing to production map services.',
 '[{"order":1,"name":"Technical Review","role":"gis_admin","action":"review"},{"order":2,"name":"Publish Approval","role":"super_admin","action":"approve"}]'),
('f1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
 'project_approve', 'Project Approval', 'project',
 'Capital projects require manager and executive approval.',
 '[{"order":1,"name":"Asset Manager Review","role":"asset_manager","action":"review"},{"order":2,"name":"Executive Approval","role":"super_admin","action":"approve"}]'),
('f1000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
 'user_provision', 'User Provisioning', 'user',
 'New user accounts require administrator approval.',
 '[{"order":1,"name":"Admin Approval","role":"super_admin","action":"approve"}]');

-- Sample pending workflow instances
INSERT INTO workflow_instances (id, tenant_id, definition_id, resource_type, resource_id, title, status, current_step, payload, submitted_by) VALUES
('f2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
 'f1000000-0000-0000-0000-000000000001', 'asset', NULL,
 'New Pipeline Segment PL-002 — Zone B Extension', 'pending', 1,
 '{"assetCode":"PL-002","name":"Zone B Extension Pipeline","assetType":"pipeline","status":"pending_approval"}',
 'c0000000-0000-0000-0000-000000000002'),
('f2000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
 'f1000000-0000-0000-0000-000000000003', 'project', 'f0000000-0000-0000-0000-000000000001',
 'Zone A Pipeline Rehabilitation — Budget Revision', 'pending', 1,
 '{"budgetChange":150000,"reason":"Additional valve replacements required"}',
 'c0000000-0000-0000-0000-000000000002'),
('f2000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
 'f1000000-0000-0000-0000-000000000002', 'layer', NULL,
 'Publish Consumer Connections Layer', 'pending', 1,
 '{"layerName":"Consumer Connections","sourceType":"geojson"}',
 'c0000000-0000-0000-0000-000000000002');

INSERT INTO workflow_tasks (instance_id, step_order, step_name, assigned_role, status) VALUES
('f2000000-0000-0000-0000-000000000001', 1, 'GIS Review', 'gis_admin', 'pending'),
('f2000000-0000-0000-0000-000000000002', 1, 'Asset Manager Review', 'asset_manager', 'pending'),
('f2000000-0000-0000-0000-000000000003', 1, 'Technical Review', 'gis_admin', 'pending');

-- Sample audit log entries
INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, details) VALUES
('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'workflow.submit', 'workflow', 'f2000000-0000-0000-0000-000000000001', '{"type":"asset_create"}'),
('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'layer.update', 'layer', NULL, '{"layerName":"Pipelines"}');

-- Additional demo users
INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, department, status) VALUES
('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'manager@egip.local',
 crypt('Manager@123', gen_salt('bf')), 'Asset', 'Manager', 'Operations', 'active'),
('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'viewer@egip.local',
 crypt('Viewer@123', gen_salt('bf')), 'Field', 'Viewer', 'Field Ops', 'active');

INSERT INTO user_roles (user_id, role_id) VALUES
('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003'),
('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004');

-- Asset manager permissions
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000003', id, 'organization'
FROM permissions WHERE resource IN ('asset', 'project', 'report') AND action IN ('create', 'read', 'update', 'approve', 'export');

-- Viewer permissions (read-only)
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000004', id, 'organization'
FROM permissions WHERE action = 'read';
