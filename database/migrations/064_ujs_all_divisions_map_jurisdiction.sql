-- All UJS field divisions: district mapping + relocate mis-placed GIS features into correct district.

-- Ensure district column exists
ALTER TABLE divisions ADD COLUMN IF NOT EXISTS district VARCHAR(100);

-- Complete division → district catalog (all 25 field divisions)
UPDATE divisions SET district = 'Chamoli'            WHERE code IN ('DIV-CHM', 'DIV-KPG');
UPDATE divisions SET district = 'Dehradun'           WHERE code IN ('DIV-DDN', 'DIV-MSR', 'DIV-VKN', 'DIV-RSK');
UPDATE divisions SET district = 'Haridwar'           WHERE code = 'DIV-HRW';
UPDATE divisions SET district = 'Nainital'           WHERE code IN ('DIV-NTL', 'DIV-LKU');
UPDATE divisions SET district = 'Almora'             WHERE code IN ('DIV-ALM', 'DIV-RNK');
UPDATE divisions SET district = 'Pauri Garhwal'      WHERE code IN ('DIV-PRG', 'DIV-KTD');
UPDATE divisions SET district = 'Tehri Garhwal'      WHERE code IN ('DIV-TNH', 'DIV-NTH', 'DIV-DVP');
UPDATE divisions SET district = 'Uttarkashi'         WHERE code IN ('DIV-UTK', 'DIV-PRL');
UPDATE divisions SET district = 'Rudraprayag'        WHERE code = 'DIV-RDP';
UPDATE divisions SET district = 'Bageshwar'          WHERE code = 'DIV-BGW';
UPDATE divisions SET district = 'Udham Singh Nagar'   WHERE code IN ('DIV-USN', 'DIV-KTM');
UPDATE divisions SET district = 'Pithoragarh'        WHERE code IN ('DIV-PTG', 'DIV-DDH');
UPDATE divisions SET district = 'Champawat'          WHERE code = 'DIV-CHP';

-- Relocate project features outside Uttarakhand into their division's district center
UPDATE project_features pf
SET geometry = ST_Translate(
  pf.geometry,
  (db.min_lon + db.max_lon) / 2.0 - ST_X(ST_Centroid(pf.geometry)),
  (db.min_lat + db.max_lat) / 2.0 - ST_Y(ST_Centroid(pf.geometry))
)
FROM projects p
INNER JOIN divisions d ON d.id = p.division_id AND d.is_headquarters = FALSE
INNER JOIN district_boundaries db ON db.tenant_id = p.tenant_id AND db.district_name = d.district
WHERE pf.project_id = p.id
  AND pf.geometry IS NOT NULL
  AND d.district IS NOT NULL
  AND (
    ST_Y(ST_Centroid(pf.geometry)) < 28.5
    OR ST_Y(ST_Centroid(pf.geometry)) > 31.6
    OR ST_X(ST_Centroid(pf.geometry)) < 77.4
    OR ST_X(ST_Centroid(pf.geometry)) > 81.1
  );

-- Fallback when district_boundaries table is empty: use division-code centers
UPDATE project_features pf
SET geometry = ST_Translate(
  pf.geometry,
  centers.center_lon - ST_X(ST_Centroid(pf.geometry)),
  centers.center_lat - ST_Y(ST_Centroid(pf.geometry))
)
FROM projects p
INNER JOIN divisions d ON d.id = p.division_id AND d.is_headquarters = FALSE
INNER JOIN (
  VALUES
    ('DIV-ALM', 79.65, 29.60), ('DIV-BGW', 79.77, 29.84), ('DIV-CHM', 79.50, 30.35),
    ('DIV-CHP', 80.28, 29.35), ('DIV-DDN', 78.05, 30.32), ('DIV-DDH', 80.35, 29.80),
    ('DIV-DVP', 78.60, 30.15), ('DIV-HRW', 78.00, 29.95), ('DIV-KPG', 79.65, 30.26),
    ('DIV-KTD', 78.52, 29.75), ('DIV-KTM', 79.97, 28.92), ('DIV-LKU', 79.52, 29.08),
    ('DIV-MSR', 78.05, 30.45), ('DIV-NTH', 78.48, 30.38), ('DIV-NTL', 79.40, 29.38),
    ('DIV-PRG', 78.78, 30.15), ('DIV-PRL', 78.42, 30.85), ('DIV-PTG', 80.22, 29.58),
    ('DIV-RDP', 79.05, 30.28), ('DIV-RNK', 79.55, 29.65), ('DIV-RSK', 78.25, 30.10),
    ('DIV-TNH', 78.48, 30.38), ('DIV-USN', 79.12, 29.05), ('DIV-UTK', 78.45, 30.73),
    ('DIV-VKN', 77.95, 30.45)
) AS centers(code, center_lon, center_lat) ON centers.code = d.code
WHERE pf.project_id = p.id
  AND pf.geometry IS NOT NULL
  AND (
    ST_Y(ST_Centroid(pf.geometry)) < 28.5
    OR ST_Y(ST_Centroid(pf.geometry)) > 31.6
    OR ST_X(ST_Centroid(pf.geometry)) < 77.4
    OR ST_X(ST_Centroid(pf.geometry)) > 81.1
  );
