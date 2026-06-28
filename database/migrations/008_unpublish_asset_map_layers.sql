-- Hide legacy asset layers from Map Explorer; only feature classes should appear there
UPDATE gis_layers
SET is_published = FALSE
WHERE source_type = 'geojson'
  AND name IN ('Reservoirs', 'Pipelines', 'Pump Houses');
