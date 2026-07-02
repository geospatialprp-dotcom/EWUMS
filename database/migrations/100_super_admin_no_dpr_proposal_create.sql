-- Super Admin must not initiate DPR proposals (Stage 1 is Division EE/JE/AE only).

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND r.code = 'super_admin'
  AND p.resource = 'dpr_proposal'
  AND p.action = 'create';
