-- Remove fake straight demo_seed pipeline from Tharali (not a real alignment).
-- Optionally copies real geometry from la_alignment_segments into la_alignment if Map Explorer is empty.
--
-- From deploy/hostinger-kvm/:
--   docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
--     psql -U egip -d egip -v ON_ERROR_STOP=1 \
--     < ../../database/scripts/vps-remove-tharali-demo-pipeline.sql

DO $$
DECLARE
  v_tenant   UUID := 'a0000000-0000-0000-0000-000000000001';
  v_project  UUID;
  v_fc       UUID;
  v_deleted  INT := 0;
  v_copied   INT := 0;
  v_remaining INT := 0;
BEGIN
  SELECT id INTO v_project
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

  IF v_project IS NULL THEN
    RAISE NOTICE 'Tharali project not found — nothing to clean';
    RETURN;
  END IF;

  SELECT id INTO v_fc
  FROM project_feature_classes
  WHERE tenant_id = v_tenant
    AND project_id = v_project
    AND (
      code = 'la_alignment'
      OR name ILIKE '%pipeline%alignment%'
      OR name ILIKE '%Pipeline Alignment%'
    )
  ORDER BY CASE code WHEN 'la_alignment' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_fc IS NULL THEN
    RAISE NOTICE 'la_alignment feature class not found on Tharali';
    RETURN;
  END IF;

  DELETE FROM project_features
  WHERE tenant_id = v_tenant
    AND project_id = v_project
    AND feature_class_id = v_fc
    AND (
      COALESCE(attributes->>'source', '') = 'demo_seed'
      OR COALESCE(attributes->>'label', '') ILIKE '%demo pipeline%'
    );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'Removed % demo_seed / fake Tharali pipeline feature(s)', v_deleted;

  SELECT COUNT(*)::int INTO v_remaining
  FROM project_features
  WHERE tenant_id = v_tenant
    AND project_id = v_project
    AND feature_class_id = v_fc
    AND geometry IS NOT NULL;

  -- If Map Explorer still empty, copy real LA case segments (if any) into la_alignment
  IF v_remaining = 0 THEN
    INSERT INTO project_features (
      tenant_id, project_id, feature_class_id, geometry, attributes
    )
    SELECT
      seg.tenant_id,
      v_project,
      v_fc,
      ST_Force2D(seg.geometry),
      jsonb_build_object(
        'source', 'la_alignment_segments',
        'la_case_id', seg.la_case_id::text,
        'component', COALESCE(seg.component, 'la_alignment'),
        'label', 'Synced from LA case alignment'
      )
    FROM la_alignment_segments seg
    INNER JOIN la_cases c ON c.id = seg.la_case_id AND c.tenant_id = seg.tenant_id
    WHERE seg.tenant_id = v_tenant
      AND seg.geometry IS NOT NULL
      AND ST_NPoints(seg.geometry) >= 2
      AND (
        COALESCE(seg.project_id, c.project_id) = v_project
        OR c.title ILIKE '%Tharali%'
      );

    GET DIAGNOSTICS v_copied = ROW_COUNT;
    RAISE NOTICE 'Copied % real la_alignment_segments into Map Explorer la_alignment', v_copied;
  ELSE
    RAISE NOTICE 'Keeping % existing non-demo alignment feature(s)', v_remaining;
  END IF;

  SELECT COUNT(*)::int INTO v_remaining
  FROM project_features
  WHERE tenant_id = v_tenant
    AND project_id = v_project
    AND feature_class_id = v_fc
    AND geometry IS NOT NULL;

  RAISE NOTICE 'Tharali la_alignment features now: %', v_remaining;
  IF v_remaining = 0 THEN
    RAISE NOTICE 'No real alignment found. Digitize in Map Explorer or use LA Auto Route → Apply & Trace.';
  END IF;
END $$;
