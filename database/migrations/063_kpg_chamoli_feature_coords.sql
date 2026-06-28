-- Karanprayag (Chamoli) demo: ensure map features for division projects lie inside Uttarakhand.
-- Some imports may have landed in Sonbhadra UP (~24N, 83E) — shift to Karanprayag (~30.26N, 79.65E).

UPDATE project_features pf
SET geometry = ST_Translate(
  pf.geometry,
  79.65 - ST_X(ST_Centroid(pf.geometry)),
  30.26 - ST_Y(ST_Centroid(pf.geometry))
)
FROM projects p
WHERE pf.project_id = p.id
  AND p.division_id = 'd1000000-0000-0000-0000-000000000010'
  AND pf.geometry IS NOT NULL
  AND (
    ST_Y(ST_Centroid(pf.geometry)) < 28.5
    OR ST_Y(ST_Centroid(pf.geometry)) > 31.6
    OR ST_X(ST_Centroid(pf.geometry)) < 77.4
    OR ST_X(ST_Centroid(pf.geometry)) > 81.1
  );
