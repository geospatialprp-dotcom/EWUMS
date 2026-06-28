-- Backfill gis_layers entries for existing project feature classes
INSERT INTO gis_layers (
  tenant_id, layer_group_id, name, source_type, source_config, default_style, is_published, sort_order
)
SELECT
  pfc.tenant_id,
  'e0000000-0000-0000-0000-000000000001',
  pfc.name,
  'project_feature_class',
  jsonb_build_object(
    'projectId', pfc.project_id,
    'featureClassId', pfc.id,
    'code', pfc.code,
    'geometryType', pfc.geometry_type
  ),
  CASE pfc.geometry_type
    WHEN 'Point' THEN '{"fill":"#7B1FA2","radius":8}'::jsonb
    WHEN 'LineString' THEN '{"stroke":"#7B1FA2","width":4}'::jsonb
    ELSE '{"fill":"#7B1FA240","stroke":"#7B1FA2","width":2}'::jsonb
  END,
  TRUE,
  10 + ROW_NUMBER() OVER (ORDER BY pfc.sort_order, pfc.name)
FROM project_feature_classes pfc
WHERE NOT EXISTS (
  SELECT 1 FROM gis_layers gl
  WHERE gl.tenant_id = pfc.tenant_id
    AND gl.source_type = 'project_feature_class'
    AND gl.source_config->>'featureClassId' = pfc.id::text
);
