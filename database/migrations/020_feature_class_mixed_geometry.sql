-- Allow a feature class to hold mixed geometry ('Any') so a single layer can
-- digitize Point, LineString AND Polygon features (and accept mixed imports).
-- The project_features.geometry column is already a generic GEOMETRY(Geometry),
-- so only the feature-class geometry_type CHECK constraint needs relaxing.

ALTER TABLE project_feature_classes
    DROP CONSTRAINT IF EXISTS project_feature_classes_geometry_type_check;

ALTER TABLE project_feature_classes
    ADD CONSTRAINT project_feature_classes_geometry_type_check
    CHECK (geometry_type IN ('Point', 'LineString', 'Polygon', 'Any'));
