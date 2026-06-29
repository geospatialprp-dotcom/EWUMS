-- Migration 092: Remove legacy seeded demo projects (Zone A, presentation seeds, Nainital demo).
-- Idempotent — safe to run multiple times. Run after 091 (complaint/consumer cleanup).
--
-- Removes: PRJ-ZAPR-2025-26 / PRJ-2025-001 (Zone A), f0000000-* seed projects, presentation DNN/HRR.
-- Keeps: divisions, users (ee.kpg, je.kpg), roles, permissions, Tharali (PRJ-TPPWSS-2026-27), dpr_proposals.
-- Standalone copy: database/scripts/cleanup-demo-kpg-data.sql (part B)

DO $$
DECLARE
  v_tenant              UUID := 'a0000000-0000-0000-0000-000000000001';
  v_deleted_projects    INT;
  v_deleted_complaints    INT;
  v_deleted_consumers     INT;
BEGIN
  CREATE TEMP TABLE tmp_demo_projects ON COMMIT DROP AS
  SELECT id, project_code, name
  FROM projects
  WHERE tenant_id = v_tenant
    AND (
      id IN (
        'f0000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000002',
        'f0000000-0000-0000-0000-000000000003',
        'f0000000-0000-0000-0000-000000000004',
        'f0000000-0000-0000-0000-000000000020',
        'f0000000-0000-0000-0000-000000000030',
        'f0000000-0000-0000-0000-000000000031'
      )
      OR (
        project_code IN ('PRJ-2025-001', 'PRJ-ZAPR-2025-26')
        AND name ILIKE '%Zone A Pipeline Rehabilitation%'
      )
    )
    AND project_code NOT IN ('PRJ-TPPWSS-2026-27', 'PRJ-2026-001')
    AND COALESCE(name, '') NOT ILIKE '%Tharali Pinder Paar%';

  IF NOT EXISTS (SELECT 1 FROM tmp_demo_projects) THEN
    RAISE NOTICE '092 demo project cleanup: no legacy demo projects found';
    RETURN;
  END IF;

  CREATE TEMP TABLE tmp_demo_consumers ON COMMIT DROP AS
  SELECT id FROM om_consumers
  WHERE tenant_id = v_tenant
    AND project_id IN (SELECT id FROM tmp_demo_projects);

  -- Billing rows tied to demo-project consumers (no CASCADE on some FKs).
  DELETE FROM om_billing_payments
  WHERE consumer_id IN (SELECT id FROM tmp_demo_consumers);

  DELETE FROM om_consumer_bills
  WHERE consumer_id IN (SELECT id FROM tmp_demo_consumers);

  DELETE FROM om_meter_readings
  WHERE consumer_id IN (SELECT id FROM tmp_demo_consumers);

  DELETE FROM om_consumer_notifications
  WHERE consumer_id IN (SELECT id FROM tmp_demo_consumers)
     OR payload->>'complaintNo' LIKE 'CMP-KPG-%'
     OR payload->>'complaint_no' LIKE 'CMP-KPG-%';

  DELETE FROM workflow_instances wi
  WHERE wi.id IN (
    SELECT c.workflow_instance_id
    FROM om_consumer_complaints c
    WHERE c.workflow_instance_id IS NOT NULL
      AND (
        c.project_id IN (SELECT id FROM tmp_demo_projects)
        OR c.om_consumer_id IN (SELECT id FROM tmp_demo_consumers)
      )
  );

  DELETE FROM om_consumer_complaints
  WHERE project_id IN (SELECT id FROM tmp_demo_projects)
     OR om_consumer_id IN (SELECT id FROM tmp_demo_consumers);
  GET DIAGNOSTICS v_deleted_complaints = ROW_COUNT;

  DELETE FROM om_consumers
  WHERE id IN (SELECT id FROM tmp_demo_consumers);
  GET DIAGNOSTICS v_deleted_consumers = ROW_COUNT;

  DELETE FROM om_contracts
  WHERE project_id IN (SELECT id FROM tmp_demo_projects);

  DELETE FROM om_asset_lifecycle_assessments
  WHERE project_id IN (SELECT id FROM tmp_demo_projects);

  DELETE FROM om_renewal_plans
  WHERE project_id IN (SELECT id FROM tmp_demo_projects);

  UPDATE dpr_reports SET workflow_instance_id = NULL
  WHERE project_id IN (SELECT id FROM tmp_demo_projects);

  UPDATE measurement_books SET workflow_instance_id = NULL
  WHERE project_id IN (SELECT id FROM tmp_demo_projects);

  UPDATE contractor_invoices SET workflow_instance_id = NULL
  WHERE project_id IN (SELECT id FROM tmp_demo_projects);

  UPDATE ra_bills SET workflow_instance_id = NULL
  WHERE project_id IN (SELECT id FROM tmp_demo_projects);

  DELETE FROM workflow_instances
  WHERE resource_type = 'project'
    AND resource_id IN (SELECT id FROM tmp_demo_projects);

  DELETE FROM workflow_instances
  WHERE id IN (
    'f1000000-0000-0000-0000-000000000003',
    'w1000000-0000-0000-0000-000000000030',
    'w1000000-0000-0000-0000-000000000031'
  );

  DELETE FROM ra_bill_lines
  WHERE ra_bill_id IN (
    SELECT id FROM ra_bills WHERE project_id IN (SELECT id FROM tmp_demo_projects)
  );

  DELETE FROM ra_bills
  WHERE project_id IN (SELECT id FROM tmp_demo_projects);

  DELETE FROM projects
  WHERE id IN (SELECT id FROM tmp_demo_projects);
  GET DIAGNOSTICS v_deleted_projects = ROW_COUNT;

  RAISE NOTICE '092 demo project cleanup: % project(s), % complaint(s), % consumer(s) removed',
    v_deleted_projects, v_deleted_complaints, v_deleted_consumers;
END $$;
