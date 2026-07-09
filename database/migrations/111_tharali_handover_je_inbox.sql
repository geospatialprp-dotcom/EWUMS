-- Tharali scheme must sit in Karanprayag division so JE/AE/EE inbox shows om_handover tasks.

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
