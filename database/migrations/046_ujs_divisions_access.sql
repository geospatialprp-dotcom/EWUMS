-- Uttarakhand Jal Sansthan — division-scoped data access
-- Division users (JE/AE/EE/Accounts) see only their division; State HQ sees all divisions.

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

ALTER TABLE users ADD COLUMN IF NOT EXISTS division_id UUID REFERENCES divisions(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS division_id UUID REFERENCES divisions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_division ON users(division_id);
CREATE INDEX IF NOT EXISTS idx_projects_division ON projects(division_id);

INSERT INTO permissions (resource, action, description) VALUES
('division', 'view_all', 'View data across all UJS divisions')
ON CONFLICT (resource, action) DO NOTHING;

-- Demo UJS divisions (tenant: Demo Water Utility)
INSERT INTO divisions (id, tenant_id, code, name, region, is_headquarters) VALUES
('d1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'HQ-UJS', 'UJS State HQ (Dehradun)', 'Uttarakhand', TRUE),
('d1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'DIV-HRW', 'Haridwar Division', 'Haridwar', FALSE),
('d1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'DIV-NTL', 'Nainital Division', 'Kumaon', FALSE),
('d1000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'DIV-ALM', 'Almora Division', 'Kumaon', FALSE),
('d1000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'DIV-TNH', 'Tehri Garhwal Division', 'Garhwal', FALSE)
ON CONFLICT (id) DO NOTHING;

-- State HQ & super admin: all divisions
UPDATE users SET division_id = 'd1000000-0000-0000-0000-000000000001'
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND email IN ('admin@egip.local', 'ee@egip.local');

-- Field division staff (Haridwar)
UPDATE users SET division_id = 'd1000000-0000-0000-0000-000000000002'
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND email IN ('je@egip.local', 'ae@egip.local', 'contractor@egip.local');

-- Accounts — Nainital division (example isolation)
UPDATE users SET division_id = 'd1000000-0000-0000-0000-000000000003'
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND email = 'accounts@egip.local';

-- HQ EE gets explicit cross-division permission (in addition to HQ division flag)
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000008', id, 'organization'
FROM permissions WHERE resource = 'division' AND action = 'view_all'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000001', id, 'organization'
FROM permissions WHERE resource = 'division' AND action = 'view_all'
ON CONFLICT DO NOTHING;

-- Demo project belongs to Haridwar division
UPDATE projects SET division_id = 'd1000000-0000-0000-0000-000000000002'
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND id = 'f0000000-0000-0000-0000-000000000001';
