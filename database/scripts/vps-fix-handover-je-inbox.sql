-- Quick VPS fix: JE inbox empty after contractor handover submit.
-- Run:
--   docker compose -f /opt/egip/deploy/hostinger-kvm/docker-compose.prod.yml \
--     --env-file /opt/egip/deploy/hostinger-kvm/.env exec -T postgres \
--     psql -U egip -d egip -v ON_ERROR_STOP=1 \
--     < /opt/egip/database/migrations/111_tharali_handover_je_inbox.sql

UPDATE projects
SET division_id = 'd1000000-0000-0000-0000-000000000010',
    updated_at = NOW()
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND (
    project_code IN ('PRJ-TPPWSS-2026-27', 'PRJ-2026-001')
    OR name ILIKE '%Tharali%'
  );

UPDATE workflow_instances wi
SET payload = COALESCE(wi.payload, '{}'::jsonb) || jsonb_build_object(
      'divisionId', 'd1000000-0000-0000-0000-000000000010'
    )
FROM om_handover h
WHERE wi.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND wi.resource_type = 'om_handover'
  AND wi.status = 'pending'
  AND h.id = wi.resource_id
  AND (
    h.scheme_name ILIKE '%Tharali%'
    OR h.project_id IN (
      SELECT id FROM projects
      WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
        AND (project_code IN ('PRJ-TPPWSS-2026-27', 'PRJ-2026-001') OR name ILIKE '%Tharali%')
    )
  );

SELECT wi.title, wi.status, t.step_name, t.assigned_role, t.status AS task_status
FROM workflow_tasks t
JOIN workflow_instances wi ON wi.id = t.instance_id
WHERE wi.resource_type = 'om_handover'
  AND wi.status = 'pending'
  AND t.status = 'pending'
ORDER BY wi.submitted_at DESC;
