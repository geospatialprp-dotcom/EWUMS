-- EGIP Seed Data (Development)

-- Default tenant
INSERT INTO tenants (id, slug, name, industry_pack, tier) VALUES
('a0000000-0000-0000-0000-000000000001', 'demo-water-utility', 'Demo Water Utility Corporation', 'water-supply', 'enterprise');

-- System permissions
INSERT INTO permissions (resource, action, description) VALUES
('user', 'create', 'Create users'),
('user', 'read', 'View users'),
('user', 'update', 'Update users'),
('user', 'delete', 'Delete users'),
('asset', 'create', 'Create assets'),
('asset', 'read', 'View assets'),
('asset', 'update', 'Update assets'),
('asset', 'delete', 'Delete assets'),
('asset', 'approve', 'Approve assets'),
('asset', 'export', 'Export assets'),
('layer', 'create', 'Create GIS layers'),
('layer', 'read', 'View GIS layers'),
('layer', 'update', 'Update GIS layers'),
('layer', 'delete', 'Delete GIS layers'),
('layer', 'publish', 'Publish GIS layers'),
('project', 'create', 'Create projects'),
('project', 'read', 'View projects'),
('project', 'update', 'Update projects'),
('project', 'delete', 'Delete projects'),
('project', 'approve', 'Approve projects'),
('survey', 'create', 'Create surveys'),
('survey', 'read', 'View surveys'),
('survey', 'update', 'Update surveys'),
('report', 'read', 'View reports'),
('report', 'export', 'Export reports'),
('report', 'print', 'Print reports'),
('iot', 'read', 'View IoT devices'),
('iot', 'update', 'Configure IoT devices'),
('audit', 'read', 'View audit logs'),
('tenant', 'update', 'Configure tenant settings');

-- Roles for demo tenant
INSERT INTO roles (id, tenant_id, code, name, is_system) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'super_admin', 'Super Administrator', TRUE),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'gis_admin', 'GIS Administrator', TRUE),
('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'asset_manager', 'Asset Manager', TRUE),
('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'viewer', 'Viewer', TRUE);

-- Assign all permissions to super_admin
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000001', id, 'organization' FROM permissions;

-- GIS admin permissions
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000002', id, 'organization'
FROM permissions WHERE resource IN ('layer', 'asset', 'report') AND action IN ('create', 'read', 'update', 'publish', 'export');

-- Demo users (password: Admin@123 and Gis@123)
INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, department) VALUES
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'admin@egip.local',
 crypt('Admin@123', gen_salt('bf')), 'System', 'Administrator', 'IT'),
('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'gis@egip.local',
 crypt('Gis@123', gen_salt('bf')), 'GIS', 'Administrator', 'GIS');

INSERT INTO user_roles (user_id, role_id) VALUES
('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001'),
('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002');

-- Water supply asset types
INSERT INTO asset_types (id, tenant_id, industry_module, code, name, geometry_type, icon, default_style) VALUES
('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'water-supply', 'reservoir', 'Reservoir', 'Polygon', 'reservoir', '{"fill":"#1565C0","stroke":"#0D47A1"}'),
('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'water-supply', 'pipeline', 'Pipeline', 'LineString', 'pipeline', '{"stroke":"#00897B","width":3}'),
('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'water-supply', 'pump_house', 'Pump House', 'Point', 'pump', '{"fill":"#F57F17","radius":8}'),
('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'water-supply', 'valve', 'Valve', 'Point', 'valve', '{"fill":"#C62828","radius":6}'),
('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'water-supply', 'consumer', 'Consumer Connection', 'Point', 'consumer', '{"fill":"#6A1B9A","radius":5}');

-- Sample assets (GeoJSON coordinates: lon, lat)
INSERT INTO assets (tenant_id, asset_code, asset_type_id, name, status, health_score, geometry, attributes, created_by) VALUES
('a0000000-0000-0000-0000-000000000001', 'RES-001', 'd0000000-0000-0000-0000-000000000001', 'Central Reservoir',
 'active', 95, ST_GeomFromText('POLYGON((77.58 12.95, 77.60 12.95, 77.60 12.97, 77.58 12.97, 77.58 12.95))', 4326),
 '{"capacity_m3":50000,"current_level_pct":78}', 'c0000000-0000-0000-0000-000000000001'),
('a0000000-0000-0000-0000-000000000001', 'PL-001', 'd0000000-0000-0000-0000-000000000002', 'Main Distribution Line',
 'active', 88, ST_GeomFromText('LINESTRING(77.58 12.96, 77.62 12.96, 77.65 12.94)', 4326),
 '{"diameter_mm":400,"material":"DI"}', 'c0000000-0000-0000-0000-000000000001'),
('a0000000-0000-0000-0000-000000000001', 'PH-001', 'd0000000-0000-0000-0000-000000000003', 'Zone A Pump House',
 'active', 72, ST_GeomFromText('POINT(77.59 12.955)', 4326),
 '{"capacity_lps":120,"power_kw":45}', 'c0000000-0000-0000-0000-000000000001'),
('a0000000-0000-0000-0000-000000000001', 'VL-001', 'd0000000-0000-0000-0000-000000000004', 'Isolation Valve V-12',
 'critical', 45, ST_GeomFromText('POINT(77.605 12.958)', 4326),
 '{"type":"gate","last_operated":"2025-11-01"}', 'c0000000-0000-0000-0000-000000000001'),
('a0000000-0000-0000-0000-000000000001', 'CC-001', 'd0000000-0000-0000-0000-000000000005', 'Consumer #4521',
 'active', 100, ST_GeomFromText('POINT(77.615 12.952)', 4326),
 '{"meter_id":"M-4521","category":"domestic"}', 'c0000000-0000-0000-0000-000000000001');

-- GIS layer groups
INSERT INTO gis_layer_groups (id, tenant_id, name, sort_order) VALUES
('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Water Supply Asset', 1),
('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Basemaps', 0);

-- GIS layers
INSERT INTO gis_layers (tenant_id, layer_group_id, name, source_type, source_config, default_style, is_published, sort_order) VALUES
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'Satellite (Google Earth style)', 'xyz',
 '{"url":"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}","attribution":"Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community","maxZoom":19}', '{}', TRUE, 0),
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'Satellite + Labels', 'xyz',
 '{"url":"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}","overlayUrl":"https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places_Alternate/MapServer/tile/{z}/{y}/{x}","attribution":"Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community","maxZoom":19}', '{}', TRUE, 1),
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'OpenStreetMap', 'xyz',
 '{"url":"https://tile.openstreetmap.org/{z}/{x}/{y}.png","attribution":"© OpenStreetMap contributors"}', '{}', TRUE, 2),
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'Google Imagery', 'google',
 '{"mapType":"satellite","attribution":"Imagery © Google","maxZoom":22}', '{}', TRUE, 3),
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'None', 'none', '{}', '{}', TRUE, 4),
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Reservoirs', 'geojson',
 '{"table":"assets","filter":{"asset_type":"reservoir"}}', '{"fill":"#1565C0"}', TRUE, 1),
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Pipelines', 'geojson',
 '{"table":"assets","filter":{"asset_type":"pipeline"}}', '{"stroke":"#00897B","width":3}', TRUE, 2),
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Pump Houses', 'geojson',
 '{"table":"assets","filter":{"asset_type":"pump_house"}}', '{"fill":"#F57F17"}', TRUE, 3);

-- Sample project
INSERT INTO projects (id, tenant_id, project_code, name, status, start_date, end_date, budget, spent, physical_progress, financial_progress, manager_id) VALUES
('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'PRJ-2025-001',
 'Zone A Pipeline Rehabilitation', 'active', '2025-01-01', '2025-12-31', 2500000, 1625000, 65, 58,
 'c0000000-0000-0000-0000-000000000001');

INSERT INTO project_milestones (project_id, name, due_date, status, progress, sort_order) VALUES
('f0000000-0000-0000-0000-000000000001', 'Survey & Design', '2025-03-31', 'completed', 100, 1),
('f0000000-0000-0000-0000-000000000001', 'Procurement', '2025-06-30', 'completed', 100, 2),
('f0000000-0000-0000-0000-000000000001', 'Pipeline Laying', '2025-10-31', 'in_progress', 70, 3),
('f0000000-0000-0000-0000-000000000001', 'Testing & Commissioning', '2025-12-15', 'pending', 0, 4);

-- IoT devices
INSERT INTO iot_devices (tenant_id, asset_id, device_code, name, device_type, status, location, last_seen_at) VALUES
('a0000000-0000-0000-0000-000000000001',
 (SELECT id FROM assets WHERE asset_code = 'RES-001'),
 'IOT-RES-001', 'Reservoir Level Sensor', 'water_level', 'active',
 ST_GeomFromText('POINT(77.59 12.96)', 4326), NOW() - INTERVAL '2 minutes'),
('a0000000-0000-0000-0000-000000000001',
 (SELECT id FROM assets WHERE asset_code = 'PH-001'),
 'IOT-PH-001', 'Pump House Pressure Sensor', 'pressure', 'active',
 ST_GeomFromText('POINT(77.59 12.955)', 4326), NOW() - INTERVAL '5 minutes');

INSERT INTO iot_alerts (tenant_id, device_id, severity, message, metric, value) VALUES
('a0000000-0000-0000-0000-000000000001',
 (SELECT id FROM iot_devices WHERE device_code = 'IOT-PH-001'),
 'critical', 'Pressure below threshold in Zone A', 'pressure_bar', 1.2);
