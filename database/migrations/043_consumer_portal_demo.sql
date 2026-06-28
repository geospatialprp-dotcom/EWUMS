-- Stage 15.8: Demo consumer for Online Consumer Portal login

INSERT INTO om_consumers (
  id, tenant_id, project_id, consumer_code, fhtc_number, consumer_name, mobile,
  village, ward, consumer_category, connection_status, notes
)
SELECT
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
WHERE NOT EXISTS (
  SELECT 1 FROM om_consumers
  WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
    AND fhtc_number = 'FHTC-DEMO-001'
);
