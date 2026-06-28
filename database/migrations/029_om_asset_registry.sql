-- O&M Stage 2: Asset registration & GIS integration

ALTER TABLE assets ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS handover_id UUID REFERENCES om_handover(id) ON DELETE SET NULL;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS om_category VARCHAR(80);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS om_subcategory VARCHAR(80);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS installation_date DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(255);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS capacity VARCHAR(100);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS warranty_details TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS design_life_years SMALLINT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS om_agency VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assets_handover ON assets(handover_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assets_om_category ON assets(tenant_id, om_category) WHERE deleted_at IS NULL;

-- O&M asset type catalogue (water supply schemes)
INSERT INTO asset_types (tenant_id, industry_module, code, name, geometry_type, icon, default_style) VALUES
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'spring_source', 'Spring Source', 'Point', 'source', '{"fill":"#0277BD"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'river_intake', 'River Intake', 'Point', 'source', '{"fill":"#01579B"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'bore_well', 'Bore Well', 'Point', 'source', '{"fill":"#0288D1"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'collection_chamber', 'Collection Chamber', 'Point', 'chamber', '{"fill":"#4FC3F7"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'gravity_main', 'Gravity Main', 'LineString', 'pipeline', '{"stroke":"#00695C"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'rising_main', 'Rising Main', 'LineString', 'pipeline', '{"stroke":"#00897B"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'valve_chamber', 'Valve Chamber', 'Point', 'valve', '{"fill":"#C62828"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'air_valve', 'Air Valve', 'Point', 'valve', '{"fill":"#E53935"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'scour_valve', 'Scour Valve', 'Point', 'valve', '{"fill":"#D32F2F"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'glsr', 'GLSR', 'Polygon', 'reservoir', '{"fill":"#1565C0"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'oht', 'OHT', 'Polygon', 'reservoir', '{"fill":"#1976D2"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'cwr', 'CWR', 'Polygon', 'reservoir', '{"fill":"#1E88E5"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'pump', 'Pump', 'Point', 'pump', '{"fill":"#F57F17"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'motor', 'Motor', 'Point', 'motor', '{"fill":"#FB8C00"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'flow_meter', 'Flow Meter', 'Point', 'meter', '{"fill":"#7B1FA2"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'chlorination_system', 'Chlorination System', 'Point', 'chlorine', '{"fill":"#43A047"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'transformer', 'Transformer', 'Point', 'electrical', '{"fill":"#5E35B1"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'ht_line', 'HT Line', 'LineString', 'electrical', '{"stroke":"#4527A0"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'lt_panel', 'LT Panel', 'Point', 'electrical', '{"fill":"#512DA8"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'dg_set', 'DG Set', 'Point', 'electrical', '{"fill":"#673AB7"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'solar_system', 'Solar System', 'Point', 'solar', '{"fill":"#F9A825"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'distribution_main', 'Distribution Main', 'LineString', 'pipeline', '{"stroke":"#2E7D32"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'sub_main', 'Sub-Main', 'LineString', 'pipeline', '{"stroke":"#388E3C"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'service_connection', 'Service Connection', 'Point', 'consumer', '{"fill":"#558B2F"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'fhtc_connection', 'FHTC Connection', 'Point', 'consumer', '{"fill":"#6A1B9A"}'),
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'consumer_meter', 'Consumer Meter', 'Point', 'meter', '{"fill":"#8E24AA"}')
ON CONFLICT (tenant_id, code) DO NOTHING;
