-- UJS Map Explorer: district boundaries, division→district mapping, division role map access
-- NOTE: Rectangle demo geometries below are replaced by real admin polygons in migration 065.

ALTER TABLE divisions ADD COLUMN IF NOT EXISTS district VARCHAR(100);

CREATE TABLE IF NOT EXISTS district_boundaries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    district_code   VARCHAR(20) NOT NULL,
    district_name   VARCHAR(100) NOT NULL,
    min_lon         DOUBLE PRECISION NOT NULL,
    min_lat         DOUBLE PRECISION NOT NULL,
    max_lon         DOUBLE PRECISION NOT NULL,
    max_lat         DOUBLE PRECISION NOT NULL,
    geometry        GEOMETRY(Polygon, 4326),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, district_code)
);

CREATE INDEX IF NOT EXISTS idx_district_boundaries_tenant ON district_boundaries(tenant_id);

-- Uttarakhand district envelopes (WGS 84) — demo boundaries for map extent & overlays
INSERT INTO district_boundaries (tenant_id, district_code, district_name, min_lon, min_lat, max_lon, max_lat, geometry) VALUES
('a0000000-0000-0000-0000-000000000001', 'ALM', 'Almora',             79.35, 29.40, 80.15, 30.05, ST_MakeEnvelope(79.35, 29.40, 80.15, 30.05, 4326)),
('a0000000-0000-0000-0000-000000000001', 'BGW', 'Bageshwar',         79.70, 29.70, 80.25, 30.25, ST_MakeEnvelope(79.70, 29.70, 80.25, 30.25, 4326)),
('a0000000-0000-0000-0000-000000000001', 'CHM', 'Chamoli',           79.02, 30.05, 79.92, 31.42, ST_MakeEnvelope(79.02, 30.05, 79.92, 31.42, 4326)),
('a0000000-0000-0000-0000-000000000001', 'CHP', 'Champawat',         80.00, 29.00, 80.65, 29.65, ST_MakeEnvelope(80.00, 29.00, 80.65, 29.65, 4326)),
('a0000000-0000-0000-0000-000000000001', 'DDN', 'Dehradun',          77.80, 30.10, 78.35, 30.65, ST_MakeEnvelope(77.80, 30.10, 78.35, 30.65, 4326)),
('a0000000-0000-0000-0000-000000000001', 'HRW', 'Haridwar',          77.75, 29.75, 78.25, 30.25, ST_MakeEnvelope(77.75, 29.75, 78.25, 30.25, 4326)),
('a0000000-0000-0000-0000-000000000001', 'NTL', 'Nainital',          79.00, 29.00, 79.75, 29.75, ST_MakeEnvelope(79.00, 29.00, 79.75, 29.75, 4326)),
('a0000000-0000-0000-0000-000000000001', 'PGR', 'Pauri Garhwal',     78.50, 29.85, 79.35, 30.55, ST_MakeEnvelope(78.50, 29.85, 79.35, 30.55, 4326)),
('a0000000-0000-0000-0000-000000000001', 'PTG', 'Pithoragarh',       80.00, 29.35, 81.00, 30.45, ST_MakeEnvelope(80.00, 29.35, 81.00, 30.45, 4326)),
('a0000000-0000-0000-0000-000000000001', 'RDP', 'Rudraprayag',       78.70, 30.15, 79.35, 30.65, ST_MakeEnvelope(78.70, 30.15, 79.35, 30.65, 4326)),
('a0000000-0000-0000-0000-000000000001', 'TGR', 'Tehri Garhwal',     78.20, 30.00, 79.10, 30.85, ST_MakeEnvelope(78.20, 30.00, 79.10, 30.85, 4326)),
('a0000000-0000-0000-0000-000000000001', 'USN', 'Udham Singh Nagar', 78.70, 28.80, 79.55, 29.35, ST_MakeEnvelope(78.70, 28.80, 79.55, 29.35, 4326)),
('a0000000-0000-0000-0000-000000000001', 'UTK', 'Uttarkashi',        77.85, 30.65, 78.95, 31.45, ST_MakeEnvelope(77.85, 30.65, 78.95, 31.45, 4326))
ON CONFLICT (tenant_id, district_code) DO UPDATE SET
  district_name = EXCLUDED.district_name,
  min_lon = EXCLUDED.min_lon,
  min_lat = EXCLUDED.min_lat,
  max_lon = EXCLUDED.max_lon,
  max_lat = EXCLUDED.max_lat,
  geometry = EXCLUDED.geometry;

-- Division → administrative district (Karanprayag office operates within Chamoli district)
UPDATE divisions SET district = 'Chamoli'           WHERE code IN ('DIV-CHM', 'DIV-KPG');
UPDATE divisions SET district = 'Dehradun'          WHERE code IN ('DIV-DDN', 'DIV-MSR', 'DIV-VKN', 'DIV-RSK');
UPDATE divisions SET district = 'Haridwar'          WHERE code = 'DIV-HRW';
UPDATE divisions SET district = 'Nainital'          WHERE code IN ('DIV-NTL', 'DIV-LKU');
UPDATE divisions SET district = 'Almora'            WHERE code IN ('DIV-ALM', 'DIV-RNK');
UPDATE divisions SET district = 'Pauri Garhwal'     WHERE code IN ('DIV-PRG', 'DIV-KTD');
UPDATE divisions SET district = 'Tehri Garhwal'     WHERE code IN ('DIV-TNH', 'DIV-NTH', 'DIV-DVP');
UPDATE divisions SET district = 'Uttarkashi'        WHERE code IN ('DIV-UTK', 'DIV-PRL');
UPDATE divisions SET district = 'Rudraprayag'       WHERE code = 'DIV-RDP';
UPDATE divisions SET district = 'Bageshwar'         WHERE code = 'DIV-BGW';
UPDATE divisions SET district = 'Udham Singh Nagar'  WHERE code IN ('DIV-USN', 'DIV-KTM');
UPDATE divisions SET district = 'Pithoragarh'       WHERE code IN ('DIV-PTG', 'DIV-DDH');
UPDATE divisions SET district = 'Champawat'         WHERE code = 'DIV-CHP';

-- Division field staff must access Map Explorer (layer:read)
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'division'
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('je', 'ae', 'ee', 'accounts', 'data_entry_operator', 'gis_operator', 'om_operator')
  AND p.resource = 'layer' AND p.action IN ('read', 'export')
ON CONFLICT DO NOTHING;
