-- Super Admin role only for State HQ account. Field division users must never have super_admin.

DELETE FROM user_roles ur
WHERE ur.role_id = 'b0000000-0000-0000-0000-000000000001'
  AND EXISTS (
    SELECT 1 FROM users u
    LEFT JOIN user_division_assignments uda ON uda.user_id = u.id
    JOIN divisions d ON d.id = COALESCE(u.division_id, uda.division_id)
    WHERE u.id = ur.user_id
      AND d.is_headquarters = FALSE
  );
