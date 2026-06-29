-- Super Admin demo: ensure dpr_proposal:approve for Stage 2 HQ review (DPRP-* at hq_review).
-- Code also grants demo operational bypass in operational-access.util.ts (dpr_proposal:approve).
-- HQ role accounts (se, ce, cgm, md) retain normal approval rights.

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'organization'
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND r.code = 'super_admin'
  AND p.resource = 'dpr_proposal'
  AND p.action = 'approve'
ON CONFLICT DO NOTHING;
