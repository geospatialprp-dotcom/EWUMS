-- Add satellite imagery basemap (Esri World Imagery)
INSERT INTO gis_layers (tenant_id, layer_group_id, name, source_type, source_config, default_style, is_published, sort_order)
SELECT
  'a0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000002',
  'Satellite Imagery',
  'xyz',
  '{"url":"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}","attribution":"Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community","maxZoom":19}',
  '{}',
  TRUE,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM gis_layers
  WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
    AND layer_group_id = 'e0000000-0000-0000-0000-000000000002'
    AND name = 'Satellite Imagery'
);
