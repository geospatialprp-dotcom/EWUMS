-- OPTIONAL — Seed a short demo LA pipeline alignment LineString for Tharali if empty.
--
-- Idempotent: inserts only when the Tharali la_alignment feature class has zero features.
-- Coordinates approximate Tharali / Karanprayag (Chamoli) corridor.
--
-- Run from deploy/hostinger-kvm/:
--   docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
--     psql -U "${DB_USERNAME:-egip}" -d "${DB_DATABASE:-egip}" -v ON_ERROR_STOP=1 \
--     < ../../database/scripts/vps-seed-tharali-pipeline-alignment.sql
--
-- One-liner:
--   docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 < ../../database/scripts/vps-seed-tharali-pipeline-alignment.sql

DO $$
DECLARE
  v_tenant     UUID := 'a0000000-0000-0000-0000-000000000001';
  v_group      UUID := 'e0000000-0000-0000-0000-000000000001';
  v_project    UUID;
  v_project_code TEXT;
  v_project_name TEXT;
  v_fc         UUID;
  v_fc_code    TEXT;
  v_fc_name    TEXT;
  v_existing   INT := 0;
  v_inserted   INT := 0;
  v_layer_synced INT := 0;
BEGIN
  SELECT id, project_code, name
  INTO v_project, v_project_code, v_project_name
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
    RAISE NOTICE 'Tharali project not found (PRJ-TPPWSS-2026-27 / %%Tharali%%) — skipping pipeline seed';
    RETURN;
  END IF;

  RAISE NOTICE 'Tharali project resolved: % (%) id=%',
    COALESCE(v_project_code, 'n/a'), COALESCE(v_project_name, 'n/a'), v_project;

  SELECT id, code, name
  INTO v_fc, v_fc_code, v_fc_name
  FROM project_feature_classes
  WHERE tenant_id = v_tenant
    AND project_id = v_project
    AND (
      code = 'la_alignment'
      OR code ILIKE '%pipeline%'
      OR code ILIKE '%alignment%'
      OR name ILIKE '%pipeline%'
      OR name ILIKE '%alignment%'
    )
    AND geometry_type = 'LineString'
  ORDER BY
    CASE code WHEN 'la_alignment' THEN 0 ELSE 1 END,
    sort_order ASC,
    created_at ASC
  LIMIT 1;

  IF v_fc IS NULL THEN
    RAISE NOTICE 'la_alignment feature class not found on Tharali — creating demo LineString class';
    INSERT INTO project_feature_classes (
      tenant_id, project_id, code, name, description,
      geometry_type, attribute_schema, default_style, sort_order
    )
    VALUES (
      v_tenant,
      v_project,
      'la_alignment',
      'LA Pipeline Alignment',
      'Pipeline / transmission alignment for land acquisition (demo seed)',
      'LineString',
      '[{"name":"source","label":"Source","type":"text"},{"name":"chainage_from","label":"Chainage From (m)","type":"number"},{"name":"chainage_to","label":"Chainage To (m)","type":"number"}]'::jsonb,
      '{"stroke":"#E53935","width":4}'::jsonb,
      10
    )
    RETURNING id, code, name INTO v_fc, v_fc_code, v_fc_name;
  END IF;

  RAISE NOTICE 'Feature class: % (%) id=%',
    COALESCE(v_fc_code, 'n/a'), COALESCE(v_fc_name, 'n/a'), v_fc;

  SELECT COUNT(*)::int INTO v_existing
  FROM project_features
  WHERE tenant_id = v_tenant
    AND project_id = v_project
    AND feature_class_id = v_fc
    AND geometry IS NOT NULL;

  RAISE NOTICE 'Existing la_alignment features: %', v_existing;

  IF v_existing = 0 THEN
    INSERT INTO project_features (
      tenant_id, project_id, feature_class_id, geometry, attributes
    )
    VALUES (
      v_tenant,
      v_project,
      v_fc,
      ST_SetSRID(
        ST_GeomFromText('LINESTRING(79.51 30.07, 79.53 30.085, 79.55 30.10)'),
        4326
      ),
      jsonb_build_object(
        'source', 'demo_seed',
        'chainage_from', 0,
        'chainage_to', NULL,
        'label', 'Tharali demo pipeline alignment'
      )
    );
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    RAISE NOTICE 'Inserted demo pipeline LineString near Tharali/Karanprayag (Chamoli): % row(s)', v_inserted;
  ELSE
    RAISE NOTICE 'Skipping insert — feature class already has % feature(s)', v_existing;
  END IF;

  -- Ensure catalog layer exists so Map Explorer can toggle the alignment
  INSERT INTO gis_layers (
    tenant_id, layer_group_id, name, source_type, source_config, default_style, is_published, sort_order
  )
  SELECT
    pfc.tenant_id,
    v_group,
    pfc.name,
    'project_feature_class',
    jsonb_build_object(
      'projectId', pfc.project_id,
      'featureClassId', pfc.id,
      'code', pfc.code,
      'geometryType', pfc.geometry_type
    ),
    COALESCE(NULLIF(pfc.default_style, '{}'::jsonb), '{"stroke":"#E53935","width":4}'::jsonb),
    TRUE,
    10
  FROM project_feature_classes pfc
  WHERE pfc.id = v_fc
    AND NOT EXISTS (
      SELECT 1 FROM gis_layers gl
      WHERE gl.tenant_id = pfc.tenant_id
        AND gl.source_type = 'project_feature_class'
        AND gl.source_config->>'featureClassId' = pfc.id::text
    );
  GET DIAGNOSTICS v_layer_synced = ROW_COUNT;

  RAISE NOTICE 'gis_layers synced for alignment: % new row(s); features now=%',
    v_layer_synced,
    (SELECT COUNT(*)::int FROM project_features
     WHERE tenant_id = v_tenant AND project_id = v_project AND feature_class_id = v_fc);

END $$;

-- Post-check
SELECT
  p.project_code,
  p.name AS project_name,
  fc.code AS feature_class_code,
  fc.name AS feature_class_name,
  fc.geometry_type,
  COUNT(pf.id) AS feature_count,
  EXISTS (
    SELECT 1 FROM gis_layers gl
    WHERE gl.source_type = 'project_feature_class'
      AND gl.source_config->>'featureClassId' = fc.id::text
  ) AS has_gis_layer
FROM projects p
JOIN project_feature_classes fc
  ON fc.project_id = p.id AND fc.tenant_id = p.tenant_id
LEFT JOIN project_features pf
  ON pf.feature_class_id = fc.id AND pf.geometry IS NOT NULL
WHERE p.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND (
    p.project_code = 'PRJ-TPPWSS-2026-27'
    OR p.name ILIKE '%Tharali%'
  )
  AND (
    fc.code = 'la_alignment'
    OR fc.code ILIKE '%pipeline%'
    OR fc.code ILIKE '%alignment%'
    OR fc.name ILIKE '%pipeline%'
    OR fc.name ILIKE '%alignment%'
  )
GROUP BY p.project_code, p.name, fc.id, fc.code, fc.name, fc.geometry_type
ORDER BY
  CASE p.project_code WHEN 'PRJ-TPPWSS-2026-27' THEN 0 ELSE 1 END,
  CASE fc.code WHEN 'la_alignment' THEN 0 ELSE 1 END;
