-- Remove Karanprayag demo complaints and portal demo consumer (fresh start).
-- Safe: keeps users (ee.kpg, je.kpg), roles, permissions, divisions, and all projects.
--
-- Demo data removed:
--   - Complaints CMP-KPG-% (migrations 087, 088)
--   - Portal demo consumer FHTC-DEMO-001 / CON-PORTAL-00001 (migrations 043, 056, 088)
--   - Related notifications and complaint workflow instances
--
-- NOT removed: projects (including legacy PRJ-2025-001 / f0000000-*), divisions, users.
--
-- Migrations 087_demo_kpg_complaints.sql and 088_demo_kpg_complaints_robust.sql remain in
-- the repo for reference but are OPTIONAL — do not re-run after cleanup.
-- Use seed-kpg-complaints-vps.sql only if you intentionally want demo complaints back.
--
-- VPS: bash database/scripts/vps-cleanup-demo-data.sh
-- Local: psql -U egip -d egip -f database/scripts/cleanup-demo-kpg-data.sql

DO $$
DECLARE
  v_tenant              UUID := 'a0000000-0000-0000-0000-000000000001';
  v_demo_consumer_id    UUID := 'c1000000-0000-0000-0000-000000000001';
  v_deleted_complaints  INT;
  v_deleted_notifs      INT;
  v_deleted_workflows   INT;
  v_deleted_consumers   INT;
BEGIN
  -- Notifications tied to demo consumer or KPG demo complaint numbers.
  DELETE FROM om_consumer_notifications
  WHERE tenant_id = v_tenant
    AND (
      consumer_id = v_demo_consumer_id
      OR payload->>'complaintNo' LIKE 'CMP-KPG-%'
      OR payload->>'complaint_no' LIKE 'CMP-KPG-%'
    );
  GET DIAGNOSTICS v_deleted_notifs = ROW_COUNT;

  DELETE FROM om_consumer_notifications n
  USING om_consumers c
  WHERE n.consumer_id = c.id
    AND c.tenant_id = v_tenant
    AND c.fhtc_number = 'FHTC-DEMO-001';

  -- Workflow instances linked to complaints we are about to delete.
  DELETE FROM workflow_instances wi
  WHERE wi.id IN (
    SELECT c.workflow_instance_id
    FROM om_consumer_complaints c
    WHERE c.tenant_id = v_tenant
      AND c.workflow_instance_id IS NOT NULL
      AND (
        c.complaint_no LIKE 'CMP-KPG-%'
        OR c.fhtc_number = 'FHTC-DEMO-001'
        OR c.om_consumer_id = v_demo_consumer_id
        OR c.id IN (
          'e2000000-0000-0000-0000-000000000001',
          'e2000000-0000-0000-0000-000000000002',
          'e2000000-0000-0000-0000-000000000003'
        )
      )
  );
  GET DIAGNOSTICS v_deleted_workflows = ROW_COUNT;

  -- Demo KPG complaints and any portal complaints from FHTC-DEMO-001.
  DELETE FROM om_consumer_complaints
  WHERE tenant_id = v_tenant
    AND (
      complaint_no LIKE 'CMP-KPG-%'
      OR fhtc_number = 'FHTC-DEMO-001'
      OR om_consumer_id = v_demo_consumer_id
      OR id IN (
        'e2000000-0000-0000-0000-000000000001',
        'e2000000-0000-0000-0000-000000000002',
        'e2000000-0000-0000-0000-000000000003'
      )
    );
  GET DIAGNOSTICS v_deleted_complaints = ROW_COUNT;

  -- Demo portal consumer only (FHTC-DEMO-001); real consumers are untouched.
  DELETE FROM om_consumers
  WHERE tenant_id = v_tenant
    AND (
      fhtc_number = 'FHTC-DEMO-001'
      OR (
        id = v_demo_consumer_id
        AND consumer_code = 'CON-PORTAL-00001'
      )
    );
  GET DIAGNOSTICS v_deleted_consumers = ROW_COUNT;

  RAISE NOTICE 'Demo cleanup: % complaint(s), % notification(s), % workflow(s), % consumer(s) removed',
    v_deleted_complaints, v_deleted_notifs, v_deleted_workflows, v_deleted_consumers;
END $$;

-- Verification (should return 0 rows each).
SELECT 'remaining_cmp_kpg' AS check, COUNT(*) AS n
FROM om_consumer_complaints
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND complaint_no LIKE 'CMP-KPG-%'
UNION ALL
SELECT 'remaining_demo_consumer', COUNT(*)
FROM om_consumers
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND fhtc_number = 'FHTC-DEMO-001';
