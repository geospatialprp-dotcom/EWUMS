-- Reset demo user passwords and ensure active status (fixes login credential issues)

UPDATE users SET
  password_hash = crypt('Admin@123', gen_salt('bf')),
  status = 'active'
WHERE email = 'admin@egip.local';

UPDATE users SET
  password_hash = crypt('Gis@123', gen_salt('bf')),
  status = 'active'
WHERE email = 'gis@egip.local';

UPDATE users SET
  password_hash = crypt('Contractor@123', gen_salt('bf')),
  status = 'active'
WHERE email = 'contractor@egip.local';

UPDATE users SET
  password_hash = crypt('JE@123', gen_salt('bf')),
  status = 'active'
WHERE email = 'je@egip.local';

UPDATE users SET
  password_hash = crypt('AE@123', gen_salt('bf')),
  status = 'active'
WHERE email = 'ae@egip.local';

UPDATE users SET
  password_hash = crypt('EE@123', gen_salt('bf')),
  status = 'active'
WHERE email = 'ee@egip.local';

UPDATE users SET
  password_hash = crypt('Accounts@123', gen_salt('bf')),
  status = 'active'
WHERE email = 'accounts@egip.local';

UPDATE users SET
  password_hash = crypt('Sec@123', gen_salt('bf')),
  status = 'active'
WHERE email = 'secretariat@egip.local';

-- Ensure admin has super_admin role
INSERT INTO user_roles (user_id, role_id)
SELECT 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = 'c0000000-0000-0000-0000-000000000001'
    AND role_id = 'b0000000-0000-0000-0000-000000000001'
);
