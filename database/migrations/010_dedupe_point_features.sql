-- Remove duplicate point features within 25 m (keep oldest per feature class)
DELETE FROM project_features pf
USING project_features keeper
WHERE pf.geometry IS NOT NULL
  AND keeper.geometry IS NOT NULL
  AND GeometryType(pf.geometry) = 'POINT'
  AND GeometryType(keeper.geometry) = 'POINT'
  AND pf.feature_class_id = keeper.feature_class_id
  AND pf.tenant_id = keeper.tenant_id
  AND pf.project_id = keeper.project_id
  AND pf.id <> keeper.id
  AND ST_DWithin(pf.geometry::geography, keeper.geometry::geography, 25)
  AND (
    keeper.created_at < pf.created_at
    OR (keeper.created_at = pf.created_at AND keeper.id::text < pf.id::text)
  );

-- Drop stray Bangalore test points when the same feature class has real site data elsewhere
DELETE FROM project_features pf
WHERE pf.geometry IS NOT NULL
  AND GeometryType(pf.geometry) = 'POINT'
  AND ST_Y(pf.geometry) BETWEEN 12.5 AND 13.5
  AND ST_X(pf.geometry) BETWEEN 77.0 AND 78.5
  AND EXISTS (
    SELECT 1
    FROM project_features site
    WHERE site.feature_class_id = pf.feature_class_id
      AND site.tenant_id = pf.tenant_id
      AND site.project_id = pf.project_id
      AND site.id <> pf.id
      AND site.geometry IS NOT NULL
      AND (
        ST_Y(site.geometry) > 25
        OR ST_X(site.geometry) > 79
      )
  );
