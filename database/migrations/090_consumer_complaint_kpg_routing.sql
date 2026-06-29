-- Fix Jal Mitra consumer complaints routing to Karanprayag (DIV-KPG) EE/JE inbox.
-- Root cause: demo consumer FHTC-DEMO-001 was linked to Haridwar project PRJ-2025-001;
-- portal complaints inherited wrong project_id and never appeared in ee.kpg@egip.local /complaints.

DO $$
DECLARE
  v_tenant       UUID := 'a0000000-0000-0000-0000-000000000001';
  v_div_kpg      UUID := 'd1000000-0000-0000-0000-000000000010';
  v_haridwar_prj UUID := 'f0000000-0000-0000-0000-000000000001';
  v_project      UUID;
  v_consumer     UUID;
BEGIN
  SELECT id INTO v_project
  FROM projects
  WHERE tenant_id = v_tenant
    AND (
      project_code = 'PRJ-TPPWSS-2026-27'
      OR project_code = 'PRJ-2026-001'
      OR name ILIKE '%Tharali%'
    )
  ORDER BY
    CASE project_code WHEN 'PRJ-TPPWSS-2026-27' THEN 0 WHEN 'PRJ-2026-001' THEN 1 ELSE 2 END,
    CASE WHEN division_id = v_div_kpg THEN 0 ELSE 1 END,
    CASE WHEN name ILIKE '%Tharali%' THEN 0 ELSE 1 END,
    created_at ASC
  LIMIT 1;

  IF v_project IS NULL THEN
    RAISE NOTICE '090: Tharali/KPG project not found — skipping consumer complaint routing fix';
    RETURN;
  END IF;

  UPDATE projects
  SET division_id = v_div_kpg
  WHERE tenant_id = v_tenant
    AND id = v_project;

  -- Re-link KPG-area portal consumers stuck on Haridwar legacy project.
  UPDATE om_consumers
  SET project_id = v_project,
      updated_at = NOW()
  WHERE tenant_id = v_tenant
    AND (
      fhtc_number = 'FHTC-DEMO-001'
      OR (
        project_id = v_haridwar_prj
        AND (
          village ILIKE '%Tharali%'
          OR village ILIKE '%Karanprayag%'
          OR village ILIKE '%Pinder%'
          OR village IS NULL
        )
      )
      OR project_id IS NULL
    );

  -- Backfill portal complaints to the correct scheme.
  UPDATE om_consumer_complaints c
  SET project_id = v_project,
      updated_at = NOW()
  WHERE c.tenant_id = v_tenant
    AND (
      c.project_id IS NULL
      OR c.project_id = v_haridwar_prj
      OR (
        c.channel = 'web_portal'
        AND c.project_id IS DISTINCT FROM v_project
        AND (
          c.village ILIKE '%Tharali%'
          OR c.village ILIKE '%Karanprayag%'
          OR c.village ILIKE '%Pinder%'
          OR c.fhtc_number = 'FHTC-DEMO-001'
        )
      )
    );

  SELECT id INTO v_consumer
  FROM om_consumers
  WHERE tenant_id = v_tenant
    AND fhtc_number = 'FHTC-DEMO-001'
  LIMIT 1;

  IF v_consumer IS NOT NULL THEN
    UPDATE om_consumers
    SET project_id = v_project,
        mobile = COALESCE(NULLIF(mobile, ''), '9876543210'),
        connection_status = 'active',
        updated_at = NOW()
    WHERE id = v_consumer;
  END IF;

  RAISE NOTICE '090: consumer complaints routed to KPG project %', v_project;
END $$;

-- EE Karanprayag must read complaints list.
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000008', p.id, 'division'
FROM permissions p
WHERE p.resource = 'om' AND p.action = 'read'
ON CONFLICT DO NOTHING;
