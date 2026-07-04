-- Rewrite legacy contractor logins:
--   contractor.negi.and.sons@egip.local  →  c.negi@egip.local
--   contractor.prp.geospatial.solutions@egip.local  →  c.prp@egip.local
-- Merges work_packages onto the short-login user when both exist.
BEGIN;

CREATE TEMP TABLE legacy_contractor_users ON COMMIT DROP AS
SELECT
  u.id,
  u.tenant_id,
  u.email AS old_email,
  'c.' || left(
    split_part(replace(split_part(lower(u.email), '@', 1), 'contractor.', ''), '.', 1),
    10
  ) || '@egip.local' AS target_email
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id AND r.code = 'contractor'
WHERE lower(u.email) LIKE 'contractor.%@egip.local';

-- Point work packages at the short-login account when it already exists.
UPDATE work_packages wp
SET contractor_id = keeper.id,
    updated_at = NOW()
FROM legacy_contractor_users l
JOIN users keeper
  ON keeper.tenant_id = l.tenant_id
 AND lower(keeper.email) = lower(l.target_email)
 AND keeper.id <> l.id
WHERE wp.contractor_id = l.id;

-- Rename legacy users when the short email is free.
UPDATE users u
SET email = l.target_email,
    updated_at = NOW()
FROM legacy_contractor_users l
WHERE u.id = l.id
  AND NOT EXISTS (
    SELECT 1
    FROM users u2
    WHERE u2.tenant_id = l.tenant_id
      AND lower(u2.email) = lower(l.target_email)
      AND u2.id <> l.id
  );

-- Remove legacy rows that were merged into an existing short-login user.
DELETE FROM users u
USING legacy_contractor_users l
WHERE u.id = l.id
  AND lower(u.email) LIKE 'contractor.%@egip.local'
  AND EXISTS (
    SELECT 1
    FROM users keeper
    WHERE keeper.tenant_id = l.tenant_id
      AND lower(keeper.email) = lower(l.target_email)
      AND keeper.id <> l.id
  );

COMMIT;

SELECT u.email, coalesce(u.department, '') AS firm
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id AND r.code = 'contractor'
ORDER BY u.email;
