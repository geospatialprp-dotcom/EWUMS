-- Revoke Super Admin DPR proposal initiation (Stage 1 is Division EE/JE/AE only).
-- Run on VPS: docker compose ... exec -T postgres psql -U egip -d egip < this file
-- Then rebuild web after pushing latest frontend (Initiate Proposal hidden for super_admin).

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND r.code = 'super_admin'
  AND p.resource = 'dpr_proposal'
  AND p.action = 'create';
