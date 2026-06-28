-- Ensure demo consumer portal login matches UI hint (FHTC-DEMO-001 / 9876543210)

INSERT INTO om_consumers (
  id, tenant_id, project_id, consumer_code, fhtc_number, consumer_name, mobile,
  village, ward, consumer_category, connection_status, notes
)
VALUES (
  'c1000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001',
  'CON-PORTAL-00001',
  'FHTC-DEMO-001',
  'Demo Household Consumer',
  '9876543210',
  'Tharali',
  'Ward 3',
  'apl',
  'active',
  'Demo account for Online Consumer Portal (15.8)'
)
ON CONFLICT (id) DO UPDATE SET
  fhtc_number = EXCLUDED.fhtc_number,
  consumer_name = EXCLUDED.consumer_name,
  mobile = EXCLUDED.mobile,
  village = EXCLUDED.village,
  ward = EXCLUDED.ward,
  consumer_category = EXCLUDED.consumer_category,
  connection_status = EXCLUDED.connection_status,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- Legacy rows created before 043 with a different mobile
UPDATE om_consumers
SET mobile = '9876543210',
    consumer_name = COALESCE(NULLIF(consumer_name, ''), 'Demo Household Consumer'),
    connection_status = 'active',
    updated_at = NOW()
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND fhtc_number = 'FHTC-DEMO-001'
  AND mobile IS DISTINCT FROM '9876543210';
