-- Map Explorer: field division staff must not inherit statewide map access.
-- JE/AE/EE and other field roles should see only their assigned division/district.

-- Remove state:view_all from field division roles (should only be on HQ/state roles).
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND p.resource = 'state'
  AND p.action = 'view_all'
  AND r.code IN (
    'je', 'ae', 'ee', 'accounts', 'gis_operator', 'om_operator',
    'data_entry_operator', 'billing_officer', 'consumer_service',
    'store_keeper', 'contractor', 'scada_operator'
  );

-- Users who have ONLY field roles must not retain state:view_all via any extra role link.
DELETE FROM user_roles ur
USING users u, roles r, role_permissions rp, permissions p
WHERE ur.user_id = u.id
  AND ur.role_id = r.id
  AND rp.role_id = r.id
  AND rp.permission_id = p.id
  AND p.resource = 'state'
  AND p.action = 'view_all'
  AND u.id NOT IN (
    SELECT ur2.user_id
    FROM user_roles ur2
    JOIN roles r2 ON r2.id = ur2.role_id
    WHERE r2.code IN (
      'super_admin', 'ce', 'md', 'cgm', 'se', 'secretariat',
      'state_finance', 'state_gis_admin', 'state_it_admin'
    )
  )
  AND u.id IN (
    SELECT ur3.user_id
    FROM user_roles ur3
    JOIN roles r3 ON r3.id = ur3.role_id
    WHERE r3.code IN (
      'je', 'ae', 'ee', 'accounts', 'gis_operator', 'om_operator',
      'data_entry_operator', 'billing_officer', 'consumer_service',
      'store_keeper', 'contractor', 'scada_operator'
    )
  );

-- Karanprayag JE demo: single je role + Karanprayag division (re-login required for JWT).
UPDATE users
SET division_id = 'd1000000-0000-0000-0000-000000000010',
    status = 'active',
    department = 'Karanprayag Division'
WHERE email = 'geospatialprp@gmail.com';

DELETE FROM user_roles ur
USING users u, roles r
WHERE ur.user_id = u.id
  AND ur.role_id = r.id
  AND u.email = 'geospatialprp@gmail.com'
  AND r.code NOT IN ('je');

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, 'b0000000-0000-0000-0000-000000000006'
FROM users u
WHERE u.email = 'geospatialprp@gmail.com'
ON CONFLICT DO NOTHING;

INSERT INTO user_division_assignments (user_id, division_id)
SELECT u.id, 'd1000000-0000-0000-0000-000000000010'
FROM users u
WHERE u.email = 'geospatialprp@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET division_id = EXCLUDED.division_id;
