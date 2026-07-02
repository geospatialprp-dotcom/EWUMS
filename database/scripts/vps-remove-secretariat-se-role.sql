-- Remove temporary SE role from Secretariat user.
-- Use this if SE was granted as a workaround during Stage 8 debugging.

DELETE FROM user_roles ur
USING users u, roles r
WHERE ur.user_id = u.id
  AND ur.role_id = r.id
  AND u.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND u.email = 'secretariat@egip.local'
  AND r.tenant_id = u.tenant_id
  AND r.code = 'se';
