-- Milestones are managed by field-division staff only (JE, AE, EE, Accounts).
-- Super Admin registers schemes; division teams define milestones.

INSERT INTO permissions (resource, action, description) VALUES
('project', 'milestone', 'Create and update scheme milestones at division level')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'division'
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND r.code IN ('je', 'ae', 'ee', 'accounts')
  AND p.resource = 'project' AND p.action = 'milestone'
ON CONFLICT DO NOTHING;

ALTER TABLE project_milestones ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE project_milestones ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
