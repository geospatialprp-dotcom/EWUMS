-- Add Gadhera Source asset type (Uttarakhand hill spring sources)

INSERT INTO asset_types (tenant_id, industry_module, code, name, geometry_type, icon, default_style) VALUES
('a0000000-0000-0000-0000-000000000001', 'water-supply', 'gadhera_source', 'Gadhera Source', 'Point', 'source', '{"fill":"#00838F"}')
ON CONFLICT (tenant_id, code) DO NOTHING;
