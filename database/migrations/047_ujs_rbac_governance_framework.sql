-- UJS Multi-Division RBAC & Data Governance Framework (Phase 1)
-- Requires migration 046 (divisions table). Adds circles, expanded divisions, roles, permissions.

-- =============================================================================
-- 1. CIRCLES (organizational layer between State HQ and Divisions)
-- =============================================================================

CREATE TABLE IF NOT EXISTS circles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code            VARCHAR(50) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    region          VARCHAR(100),
    is_state_hq     BOOLEAN NOT NULL DEFAULT FALSE,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_circles_tenant ON circles(tenant_id, status);

ALTER TABLE divisions ADD COLUMN IF NOT EXISTS circle_id UUID REFERENCES circles(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS circle_id UUID REFERENCES circles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_divisions_circle ON divisions(circle_id);
CREATE INDEX IF NOT EXISTS idx_users_circle ON users(circle_id);

-- Demo UJS circles (tenant: Demo Water Utility)
INSERT INTO circles (id, tenant_id, code, name, region, is_state_hq) VALUES
('c2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'HQ-STATE', 'UJS State Headquarters', 'Dehradun', TRUE),
('c2000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'CIR-GARHWAL', 'Garhwal Circle', 'Garhwal', FALSE),
('c2000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'CIR-KUMAON', 'Kumaon Circle', 'Kumaon', FALSE)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 2. FULL UJS DIVISION CATALOG
-- =============================================================================

INSERT INTO divisions (id, tenant_id, code, name, region, is_headquarters, circle_id) VALUES
('d1000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'DIV-CHM', 'Chamoli Division', 'Garhwal', FALSE, 'c2000000-0000-0000-0000-000000000002'),
('d1000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'DIV-DDN', 'Dehradun Division', 'Garhwal', FALSE, 'c2000000-0000-0000-0000-000000000002'),
('d1000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'DIV-PRG', 'Pauri Division', 'Garhwal', FALSE, 'c2000000-0000-0000-0000-000000000002'),
('d1000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'DIV-UTK', 'Uttarkashi Division', 'Garhwal', FALSE, 'c2000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

UPDATE divisions SET circle_id = 'c2000000-0000-0000-0000-000000000001', is_headquarters = TRUE
WHERE id = 'd1000000-0000-0000-0000-000000000001';

UPDATE divisions SET circle_id = 'c2000000-0000-0000-0000-000000000002'
WHERE id IN (
  'd1000000-0000-0000-0000-000000000002',
  'd1000000-0000-0000-0000-000000000005'
);

UPDATE divisions SET circle_id = 'c2000000-0000-0000-0000-000000000003'
WHERE id IN (
  'd1000000-0000-0000-0000-000000000003',
  'd1000000-0000-0000-0000-000000000004'
);

-- =============================================================================
-- 3. SCOPE & MODULE PERMISSIONS
-- =============================================================================

INSERT INTO permissions (resource, action, description) VALUES
('circle', 'view', 'View all divisions under assigned circle (SE)'),
('state', 'view_all', 'View all divisions statewide (CE, CGM, MD, State officers)'),
('billing', 'read', 'View billing and revenue records'),
('billing', 'create', 'Create billing demands and adjustments'),
('billing', 'approve', 'Approve billing and collection actions'),
('finance', 'read', 'View financial ledgers and reports'),
('finance', 'approve', 'Approve financial transactions'),
('dashboard', 'read', 'View dashboards'),
('document', 'read', 'View documents'),
('document', 'create', 'Upload documents'),
('document', 'approve', 'Approve document releases'),
('inventory', 'read', 'View inventory'),
('inventory', 'update', 'Manage store and inventory'),
('procurement', 'read', 'View procurement'),
('procurement', 'approve', 'Approve procurement'),
('scada', 'read', 'View SCADA monitoring'),
('scada', 'update', 'Configure SCADA alerts'),
('water_quality', 'read', 'View water quality records'),
('water_quality', 'create', 'Submit water quality samples'),
('complaint', 'read', 'View consumer complaints'),
('complaint', 'update', 'Manage complaint resolution'),
('consumer', 'read', 'View consumer records'),
('consumer', 'update', 'Manage consumer accounts')
ON CONFLICT (resource, action) DO NOTHING;

-- =============================================================================
-- 4. ROLES — State, Circle, Division, External
-- =============================================================================

INSERT INTO roles (id, tenant_id, code, name, is_system) VALUES
('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'md', 'Managing Director', TRUE),
('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'cgm', 'Chief General Manager', TRUE),
('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'ce', 'Chief Engineer', TRUE),
('b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 'state_finance', 'State Finance Controller', TRUE),
('b0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001', 'state_gis_admin', 'State GIS Administrator', TRUE),
('b0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000001', 'state_it_admin', 'State IT Administrator', TRUE),
('b0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000001', 'se', 'Superintending Engineer (SE)', TRUE),
('b0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000001', 'gis_operator', 'GIS Operator', TRUE),
('b0000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000001', 'billing_officer', 'Billing Officer', TRUE),
('b0000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000001', 'om_operator', 'O&M Operator', TRUE),
('b0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000001', 'scada_operator', 'SCADA Operator', TRUE),
('b0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000001', 'store_keeper', 'Store Keeper', TRUE),
('b0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000001', 'consumer_service', 'Consumer Service Officer', TRUE),
('b0000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-000000000001', 'data_entry_operator', 'Data Entry Operator', TRUE),
('b0000000-0000-0000-0000-000000000024', 'a0000000-0000-0000-0000-000000000001', 'consultant', 'Consultant', TRUE),
('b0000000-0000-0000-0000-000000000025', 'a0000000-0000-0000-0000-000000000001', 'inspector', 'Third Party Inspector', TRUE),
('b0000000-0000-0000-0000-000000000026', 'a0000000-0000-0000-0000-000000000001', 'lab_user', 'Laboratory User', TRUE)
ON CONFLICT (id) DO NOTHING;

-- State leadership — statewide view
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'organization'
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('md', 'cgm', 'ce', 'state_finance')
  AND (
    (p.resource = 'state' AND p.action = 'view_all')
    OR (p.resource IN ('dashboard', 'project', 'construction', 'om', 'billing', 'finance', 'report', 'asset', 'layer') AND p.action IN ('read', 'export', 'approve'))
  )
ON CONFLICT DO NOTHING;

-- State GIS admin
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000014', id, 'organization'
FROM permissions
WHERE resource IN ('state', 'layer', 'asset', 'survey', 'dashboard')
  AND action IN ('view_all', 'read', 'create', 'update', 'delete', 'publish')
ON CONFLICT DO NOTHING;

-- State IT admin
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000015', id, 'organization'
FROM permissions
WHERE resource IN ('user', 'tenant', 'audit', 'division', 'state')
ON CONFLICT DO NOTHING;

-- SE — circle scope
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000016', id, 'circle'
FROM permissions
WHERE (resource = 'circle' AND action = 'view')
   OR (resource IN ('project', 'construction', 'om', 'billing', 'dashboard', 'asset', 'layer', 'complaint', 'scada') AND action = 'read')
   OR (resource = 'construction' AND action = 'approve')
ON CONFLICT DO NOTHING;

-- GIS operator — division scope (inherits via division_id)
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000017', id, 'division'
FROM permissions
WHERE resource IN ('layer', 'asset', 'survey', 'project') AND action IN ('read', 'create', 'update')
ON CONFLICT DO NOTHING;

-- Billing officer
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000018', id, 'division'
FROM permissions
WHERE resource IN ('billing', 'consumer', 'report', 'project') AND action IN ('read', 'create', 'update', 'approve', 'export')
ON CONFLICT DO NOTHING;

-- O&M operator
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000019', id, 'division'
FROM permissions
WHERE resource IN ('om', 'complaint', 'asset', 'project', 'scada', 'water_quality')
  AND action IN ('read', 'create', 'update', 'submit')
ON CONFLICT DO NOTHING;

-- SCADA operator
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000020', id, 'division'
FROM permissions WHERE resource IN ('scada', 'om', 'project') AND action IN ('read', 'update')
ON CONFLICT DO NOTHING;

-- Store keeper
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000021', id, 'division'
FROM permissions WHERE resource IN ('inventory', 'procurement', 'project') AND action IN ('read', 'update')
ON CONFLICT DO NOTHING;

-- Consumer service officer
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000022', id, 'division'
FROM permissions WHERE resource IN ('consumer', 'complaint', 'billing', 'project') AND action IN ('read', 'update')
ON CONFLICT DO NOTHING;

-- Grant state:view_all to super_admin and CE role
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'organization'
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('super_admin', 'ce', 'md', 'cgm')
  AND p.resource = 'state' AND p.action = 'view_all'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 5. SECURITY EVENTS (unauthorized access monitoring)
-- =============================================================================

CREATE TABLE IF NOT EXISTS security_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type      VARCHAR(50) NOT NULL,
    resource_type   VARCHAR(100),
    resource_id     UUID,
    division_id     UUID REFERENCES divisions(id) ON DELETE SET NULL,
    details         JSONB DEFAULT '{}',
    ip_address      INET,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_tenant_time ON security_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id, created_at DESC);

-- =============================================================================
-- 6. ABAC — time-bound cross-division grants (optional overrides)
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_access_grants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    division_id     UUID REFERENCES divisions(id) ON DELETE CASCADE,
    circle_id       UUID REFERENCES circles(id) ON DELETE CASCADE,
    resource_type   VARCHAR(100),
    resource_id     UUID,
    granted_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    reason          TEXT,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    CHECK (division_id IS NOT NULL OR circle_id IS NOT NULL OR resource_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_user_access_grants_user ON user_access_grants(user_id, expires_at);

-- =============================================================================
-- 7. HELPER FUNCTIONS (for RLS and application scope resolution)
-- =============================================================================

CREATE OR REPLACE FUNCTION ujs_user_access_scope(p_user_id UUID)
RETURNS VARCHAR(20)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_scope VARCHAR(20) := 'division';
BEGIN
  IF EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id AND r.code = 'super_admin'
  ) THEN
    RETURN 'global';
  END IF;

  IF EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id AND p.resource = 'state' AND p.action = 'view_all'
  ) OR EXISTS (
    SELECT 1 FROM users u
    JOIN divisions d ON d.id = u.division_id
    WHERE u.id = p_user_id AND d.is_headquarters = TRUE
  ) THEN
    RETURN 'state';
  END IF;

  IF EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id AND p.resource = 'circle' AND p.action = 'view'
  ) THEN
    RETURN 'circle';
  END IF;

  RETURN v_scope;
END;
$$;

CREATE OR REPLACE FUNCTION ujs_accessible_division_ids(p_user_id UUID, p_tenant_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_scope VARCHAR(20);
  v_division_id UUID;
  v_circle_id UUID;
BEGIN
  v_scope := ujs_user_access_scope(p_user_id);

  IF v_scope IN ('global', 'state') THEN
    RETURN ARRAY(SELECT id FROM divisions WHERE tenant_id = p_tenant_id AND status = 'active');
  END IF;

  SELECT division_id, circle_id INTO v_division_id, v_circle_id
  FROM users WHERE id = p_user_id;

  IF v_scope = 'circle' AND v_circle_id IS NOT NULL THEN
    RETURN ARRAY(
      SELECT id FROM divisions
      WHERE tenant_id = p_tenant_id AND circle_id = v_circle_id AND status = 'active'
    );
  END IF;

  IF v_division_id IS NOT NULL THEN
    RETURN ARRAY[v_division_id];
  END IF;

  RETURN ARRAY[]::UUID[];
END;
$$;
