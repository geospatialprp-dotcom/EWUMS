-- UJS divisions without ALTER TABLE users (for DB setups where egip does not own users)
-- Uses user_division_assignments instead of users.division_id

CREATE TABLE IF NOT EXISTS divisions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code            VARCHAR(50) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    region          VARCHAR(100),
    is_headquarters BOOLEAN NOT NULL DEFAULT FALSE,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_divisions_tenant ON divisions(tenant_id, status);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS division_id UUID REFERENCES divisions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_division ON projects(division_id);

CREATE TABLE IF NOT EXISTS user_division_assignments (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    division_id     UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    assigned_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_division_assignments_division ON user_division_assignments(division_id);

INSERT INTO permissions (resource, action, description) VALUES
('division', 'view_all', 'View data across all UJS divisions')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO divisions (id, tenant_id, code, name, region, is_headquarters) VALUES
('d1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'HQ-UJS', 'UJS State HQ (Dehradun)', 'Uttarakhand', TRUE),
('d1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'DIV-HRW', 'Haridwar Division', 'Haridwar', FALSE),
('d1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'DIV-NTL', 'Nainital Division', 'Kumaon', FALSE),
('d1000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'DIV-ALM', 'Almora Division', 'Kumaon', FALSE),
('d1000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'DIV-TNH', 'Tehri Garhwal Division', 'Garhwal', FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_division_assignments (user_id, division_id)
SELECT u.id, 'd1000000-0000-0000-0000-000000000001'
FROM users u
WHERE u.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND u.email IN ('admin@egip.local', 'ee@egip.local')
ON CONFLICT (user_id) DO UPDATE SET division_id = EXCLUDED.division_id;

INSERT INTO user_division_assignments (user_id, division_id)
SELECT u.id, 'd1000000-0000-0000-0000-000000000002'
FROM users u
WHERE u.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND u.email IN ('je@egip.local', 'ae@egip.local', 'contractor@egip.local')
ON CONFLICT (user_id) DO UPDATE SET division_id = EXCLUDED.division_id;

INSERT INTO user_division_assignments (user_id, division_id)
SELECT u.id, 'd1000000-0000-0000-0000-000000000003'
FROM users u
WHERE u.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND u.email = 'accounts@egip.local'
ON CONFLICT (user_id) DO UPDATE SET division_id = EXCLUDED.division_id;

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000008', id, 'organization'
FROM permissions WHERE resource = 'division' AND action = 'view_all'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000001', id, 'organization'
FROM permissions WHERE resource = 'division' AND action = 'view_all'
ON CONFLICT DO NOTHING;

UPDATE projects SET division_id = 'd1000000-0000-0000-0000-000000000002'
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND id = 'f0000000-0000-0000-0000-000000000001';
