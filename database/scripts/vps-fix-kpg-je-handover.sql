-- Karanprayag JE demo user + handover workflow repair.
-- JE login: geospatialprp@gmail.com / JE@123

UPDATE users
SET password_hash = crypt('JE@123', gen_salt('bf')),
    division_id = 'd1000000-0000-0000-0000-000000000010',
    status = 'active',
    department = 'Karanprayag Division'
WHERE email = 'geospatialprp@gmail.com';

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

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000006', p.id, 'division'
FROM permissions p
WHERE p.resource = 'om' AND p.action IN ('read', 'update', 'approve')
ON CONFLICT DO NOTHING;

UPDATE projects
SET division_id = 'd1000000-0000-0000-0000-000000000010'
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND (project_code IN ('PRJ-TPPWSS-2026-27', 'PRJ-2026-001') OR name ILIKE '%Tharali%');

INSERT INTO workflow_tasks (instance_id, step_order, step_name, assigned_role, status)
SELECT wi.id, wi.current_step, 'JE Verification', 'je', 'pending'
FROM workflow_instances wi
JOIN om_handover h ON h.workflow_instance_id = wi.id
WHERE wi.resource_type = 'om_handover'
  AND wi.status = 'pending'
  AND h.status = 'je_review'
  AND NOT EXISTS (
    SELECT 1 FROM workflow_tasks t
    WHERE t.instance_id = wi.id AND t.status = 'pending'
  );

SELECT u.email, array_agg(DISTINCT r.code) AS roles, u.division_id
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE u.email = 'geospatialprp@gmail.com'
GROUP BY u.email, u.division_id;

SELECT h.scheme_name, h.status, t.assigned_role, t.status AS task_status
FROM om_handover h
LEFT JOIN workflow_instances wi ON wi.id = h.workflow_instance_id
LEFT JOIN workflow_tasks t ON t.instance_id = wi.id AND t.status = 'pending'
WHERE h.scheme_name ILIKE '%Tharali%'
ORDER BY h.created_at DESC
LIMIT 3;
