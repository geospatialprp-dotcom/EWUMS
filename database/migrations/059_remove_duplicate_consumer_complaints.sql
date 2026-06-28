-- Remove accidental duplicate complaints from consumer portal double-submit (keep CMP-2026-00002).

DELETE FROM om_consumer_notifications
WHERE consumer_id = 'c1000000-0000-0000-0000-000000000001'
  AND event_type IN ('complaint_registered', 'complaint_status', 'complaint_closed')
  AND payload->>'complaintNo' IN ('CMP-2026-00003', 'CMP-2026-00004');

DELETE FROM om_consumer_complaints
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND complaint_no IN ('CMP-2026-00003', 'CMP-2026-00004')
  AND (
    om_consumer_id = 'c1000000-0000-0000-0000-000000000001'
    OR fhtc_number = 'FHTC-DEMO-001'
  );
