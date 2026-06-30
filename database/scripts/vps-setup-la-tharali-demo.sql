-- OPTIONAL — Tharali LA demo setup for UJS / VPS (DPRP-2026-27-KPG-0001)
--
-- Use when an LA case exists but is not linked to the DPR GIS workspace, or when
-- you need to verify/fix linkage before an EE demo.
--
-- Preferred path (no SQL): log in as ee.kpg@egip.local → DPR Planning → Stage 3
-- → "Create LA Case (opens GIS workspace for pipeline trace)".
--
-- Run from deploy/hostinger-kvm/:
--   docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
--     psql -U "${DB_USERNAME:-egip}" -d "${DB_DATABASE:-egip}" -v ON_ERROR_STOP=1 \
--     < ../../database/scripts/vps-setup-la-tharali-demo.sql
--
-- One-liner:
--   docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 < ../../database/scripts/vps-setup-la-tharali-demo.sql

DO $$
DECLARE
  v_tenant       UUID := 'a0000000-0000-0000-0000-000000000001';
  v_div_kpg      UUID := 'd1000000-0000-0000-0000-000000000010';
  v_proposal     UUID;
  v_proposal_no  TEXT := 'DPRP-2026-27-KPG-0001';
  v_tharali      UUID;
  v_workspace    UUID;
  v_case         RECORD;
  v_linked       INT := 0;
BEGIN
  SELECT id INTO v_proposal
  FROM dpr_proposals
  WHERE tenant_id = v_tenant AND proposal_no = v_proposal_no
  LIMIT 1;

  IF v_proposal IS NULL THEN
    RAISE EXCEPTION 'DPR proposal % not found — run migrations/seeds first', v_proposal_no;
  END IF;

  SELECT id INTO v_tharali
  FROM projects
  WHERE tenant_id = v_tenant
    AND (
      project_code = 'PRJ-TPPWSS-2026-27'
      OR name ILIKE '%Tharali Pinder Paar%'
      OR name ILIKE '%Tharali%'
    )
  ORDER BY
    CASE project_code WHEN 'PRJ-TPPWSS-2026-27' THEN 0 ELSE 1 END,
    CASE WHEN name ILIKE '%Tharali Pinder Paar%' THEN 0 ELSE 1 END,
    created_at ASC
  LIMIT 1;

  -- Reuse existing DPR GIS workspace for this proposal if present
  SELECT p.id INTO v_workspace
  FROM projects p
  JOIN la_cases c ON c.project_id = p.id AND c.tenant_id = p.tenant_id
  WHERE c.dpr_proposal_id = v_proposal
    AND p.tenant_id = v_tenant
    AND p.status = 'dpr_gis_workspace'
  LIMIT 1;

  IF v_workspace IS NULL THEN
    SELECT project_id INTO v_workspace
    FROM dpr_proposals
    WHERE id = v_proposal AND tenant_id = v_tenant AND project_id IS NOT NULL;
  END IF;

  IF v_workspace IS NULL THEN
    INSERT INTO projects (
      tenant_id, project_code, name, description, status,
      spent, physical_progress, financial_progress, division_id
    )
    SELECT
      v_tenant,
      'PRJ-DPR-' || REPLACE(v_proposal_no, '-', ''),
      COALESCE(dp.title, 'Tharali Pinder Paar WSS — DPR GIS workspace'),
      'GIS workspace for DPR ' || v_proposal_no || ' (pre-tender land acquisition)',
      'dpr_gis_workspace',
      0, 0, 0,
      COALESCE(dp.division_id, v_div_kpg)
    FROM dpr_proposals dp
    WHERE dp.id = v_proposal
    ON CONFLICT (tenant_id, project_code) DO UPDATE
      SET updated_at = NOW()
    RETURNING id INTO v_workspace;
  END IF;

  UPDATE dpr_proposals
  SET project_id = COALESCE(project_id, v_workspace),
      updated_at = NOW()
  WHERE id = v_proposal AND tenant_id = v_tenant;

  FOR v_case IN
    SELECT id, case_no, title
    FROM la_cases
    WHERE tenant_id = v_tenant
      AND (
        dpr_proposal_id = v_proposal
        OR (
          dpr_proposal_id IS NULL
          AND (
            title ILIKE '%Tharali%'
            OR title ILIKE '%Pinder Paar%'
            OR case_no ILIKE '%THARALI%'
            OR case_no ILIKE '%KPG%'
          )
        )
      )
  LOOP
    UPDATE la_cases
    SET dpr_proposal_id = COALESCE(dpr_proposal_id, v_proposal),
        project_id = COALESCE(project_id, v_workspace),
        division_id = COALESCE(division_id, v_div_kpg),
        updated_at = NOW()
    WHERE id = v_case.id;

    v_linked := v_linked + 1;
    RAISE NOTICE 'Linked LA case % (%) → DPR % / workspace %',
      v_case.case_no, v_case.title, v_proposal_no, v_workspace;
  END LOOP;

  RAISE NOTICE 'Tharali LA demo ready — % case(s), DPR %, workspace %, construction project %',
    v_linked, v_proposal_no, v_workspace, COALESCE(v_tharali::text, 'n/a');
END $$;

-- Post-check for EE demo
SELECT
  c.case_no,
  c.title,
  c.dpr_proposal_id IS NOT NULL AS has_dpr,
  c.project_id IS NOT NULL AS has_project,
  dp.proposal_no,
  p.project_code,
  p.status AS project_status
FROM la_cases c
LEFT JOIN dpr_proposals dp ON dp.id = c.dpr_proposal_id
LEFT JOIN projects p ON p.id = c.project_id
WHERE c.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND (
    dp.proposal_no = 'DPRP-2026-27-KPG-0001'
    OR c.title ILIKE '%Tharali%'
    OR c.title ILIKE '%Pinder Paar%'
  )
ORDER BY c.updated_at DESC;
