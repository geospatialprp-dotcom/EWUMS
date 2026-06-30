-- Idempotent fix: ensure DPR PDF review permissions exist on VPS instances
-- where 094 tables were created but role grants were missing or stale.

INSERT INTO permissions (resource, action, description) VALUES
  ('dpr_pdf_review', 'read', 'View DPR PDF review sessions and annotations'),
  ('dpr_pdf_review', 'annotate', 'Create and edit PDF redline annotations'),
  ('dpr_pdf_review', 'comment', 'Add discussion comments on PDF review')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'organization'
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND p.resource = 'dpr_pdf_review'
  AND r.code IN ('super_admin', 'ee', 'se', 'ce', 'cgm', 'md', 'je', 'ae')
ON CONFLICT DO NOTHING;
