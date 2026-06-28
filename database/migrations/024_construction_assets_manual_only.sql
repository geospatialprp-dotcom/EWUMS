-- GIS assets must be registered manually in the app (remove demo pre-seed from migration 013)
DELETE FROM construction_documents
WHERE resource_type = 'construction_asset'
  AND resource_id IN (
    SELECT id FROM construction_assets
    WHERE asset_code IN ('SRC-001', 'GV-001', 'AV-001', 'PH-001', 'GLSR-001')
  );

DELETE FROM construction_assets
WHERE asset_code IN ('SRC-001', 'GV-001', 'AV-001', 'PH-001', 'GLSR-001');

UPDATE project_completion pc
SET gis_mapping_pct = COALESCE(sub.pct, 0),
    updated_at = NOW()
FROM (
  SELECT
    ca.project_id,
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND(
        (COUNT(*) FILTER (WHERE ca.latitude IS NOT NULL AND ca.longitude IS NOT NULL)::numeric / COUNT(*)) * 1000
      ) / 10
    END AS pct
  FROM construction_assets ca
  GROUP BY ca.project_id
) sub
WHERE pc.project_id = sub.project_id;

UPDATE project_completion
SET gis_mapping_pct = 0,
    updated_at = NOW()
WHERE project_id NOT IN (SELECT DISTINCT project_id FROM construction_assets);
