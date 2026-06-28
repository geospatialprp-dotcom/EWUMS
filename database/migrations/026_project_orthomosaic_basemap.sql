-- Optional per-project drone orthomosaic as an XYZ tile basemap on the map.
-- tileUrl must be a standard slippy-map template, e.g. https://tiles.example.com/{z}/{x}/{y}.png

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS orthomosaic_config JSONB;

COMMENT ON COLUMN projects.orthomosaic_config IS
    'Optional drone orthomosaic XYZ tiles: { "tileUrl", "name", "attribution", "maxZoom" }';
