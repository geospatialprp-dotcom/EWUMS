-- Roll back 079: Karanprayag EE login is only ee.kpg@egip.local (050/051).

DELETE FROM user_roles
WHERE user_id = 'c0000000-0000-0000-0000-000000000014';

DELETE FROM user_division_assignments
WHERE user_id = 'c0000000-0000-0000-0000-000000000014';

DELETE FROM users
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND email = 'ee.kgp@egip.local';
