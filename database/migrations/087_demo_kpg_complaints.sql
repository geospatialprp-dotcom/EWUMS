-- Karanprayag (DIV-KPG) demo complaints for /complaints JE dashboard.
-- Tharali Pinder Paar WSS is the division scheme; complaints must carry project_id.

-- Ensure Tharali scheme stays on Karanprayag division (idempotent).
UPDATE projects
SET division_id = 'd1000000-0000-0000-0000-000000000010'
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND id = 'f0000000-0000-0000-0000-000000000001';

-- Backfill complaints missing project_id from linked consumer.
UPDATE om_consumer_complaints c
SET project_id = oc.project_id
FROM om_consumers oc
WHERE c.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND c.project_id IS NULL
  AND c.om_consumer_id = oc.id
  AND oc.project_id IS NOT NULL;

INSERT INTO om_consumer_complaints (
  id, tenant_id, project_id, om_consumer_id, complaint_no, consumer_id, fhtc_number,
  mobile, village, complaint_type, channel, description, status, priority,
  assigned_to, assigned_at, response_time_mins, created_at
)
VALUES
(
  'e2000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  'CMP-KPG-2026-00001',
  'CON-PORTAL-00001',
  'FHTC-DEMO-001',
  '9876543210',
  'Tharali',
  'no_water_supply',
  'web_portal',
  'No water since morning at Ward 3, Tharali.',
  'ticket_generated',
  'high',
  NULL, NULL, NULL,
  NOW() - INTERVAL '2 days'
),
(
  'e2000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001',
  NULL,
  'CMP-KPG-2026-00002',
  NULL,
  'FHTC-KPG-0042',
  '9876501234',
  'Pinder',
  'low_pressure',
  'call_centre',
  'Low pressure reported near Pinder market area.',
  'assigned',
  'medium',
  'c0000000-0000-0000-0000-000000000011',
  NOW() - INTERVAL '1 day',
  45,
  NOW() - INTERVAL '3 days'
),
(
  'e2000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001',
  NULL,
  'CMP-KPG-2026-00003',
  NULL,
  'FHTC-KPG-0018',
  '9876512345',
  'Karanprayag',
  'leakage',
  'whatsapp',
  'Pipeline leakage near main road — resolved and chlorinated.',
  'closed',
  'medium',
  'c0000000-0000-0000-0000-000000000011',
  NOW() - INTERVAL '5 days',
  30,
  NOW() - INTERVAL '7 days'
)
ON CONFLICT (tenant_id, complaint_no) DO NOTHING;

UPDATE om_consumer_complaints
SET
  resolution_notes = COALESCE(resolution_notes, 'Leak repaired; line pressure restored.'),
  resolved_at = COALESCE(resolved_at, NOW() - INTERVAL '6 days'),
  consumer_feedback = COALESCE(consumer_feedback, 'Satisfied with quick response.'),
  feedback_at = COALESCE(feedback_at, NOW() - INTERVAL '5 days'),
  closed_at = COALESCE(closed_at, NOW() - INTERVAL '5 days')
WHERE id = 'e2000000-0000-0000-0000-000000000003';
