-- Remove ALL Karanprayag / portal demo data AND legacy seeded demo projects (fresh start).
-- Safe: keeps users (ee.kpg, je.kpg), roles, permissions, divisions, Tharali (PRJ-TPPWSS-2026-27).
--
-- Part A — complaints & demo consumers (migrations 043, 056, 087, 088, 090):
--   CMP-KPG-%, CMP-2026-* portal demo, FHTC-DEMO-001, FHTC-KPG-*, Demo Household Consumer
--
-- Part B — legacy demo projects (migrations 002, 067, demo-seed.sql):
--   PRJ-ZAPR-2025-26 / PRJ-2025-001 Zone A Pipeline Rehabilitation
--   f0000000-* seed UUIDs (presentation DNN/HRR, Nainital Badhangarhi, dev-mock schemes)
--   Related: milestones, construction, om_consumers, complaints, workflows (FK-safe order)
--
-- NOT removed: divisions, users (ee.kpg, je.kpg), roles, permissions, dpr_proposals, Tharali.
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
  -- Notifications tied to demo consumers or demo complaint numbers.
  DELETE FROM om_consumer_notifications
  WHERE tenant_id = v_tenant
    AND (
      consumer_id = v_demo_consumer_id
      OR consumer_id IN (
        SELECT id FROM om_consumers
        WHERE tenant_id = v_tenant
          AND (
            fhtc_number = 'FHTC-DEMO-001'
            OR fhtc_number LIKE 'FHTC-KPG-%'
            OR consumer_name = 'Demo Household Consumer'
            OR consumer_code = 'CON-PORTAL-00001'
          )
      )
      OR payload->>'complaintNo' LIKE 'CMP-KPG-%'
      OR payload->>'complaint_no' LIKE 'CMP-KPG-%'
      OR payload->>'complaintNo' LIKE 'CMP-2026-%'
      OR payload->>'complaint_no' LIKE 'CMP-2026-%'
    );
  GET DIAGNOSTICS v_deleted_notifs = ROW_COUNT;

  DELETE FROM om_consumer_notifications n
  USING om_consumers c
  WHERE n.consumer_id = c.id
    AND c.tenant_id = v_tenant
    AND (
      c.fhtc_number = 'FHTC-DEMO-001'
      OR c.fhtc_number LIKE 'FHTC-KPG-%'
      OR c.consumer_name = 'Demo Household Consumer'
      OR c.consumer_code = 'CON-PORTAL-00001'
    );

  -- Detach workflow FKs before deleting workflow rows or complaints.
  UPDATE om_consumer_complaints c
  SET workflow_instance_id = NULL
  WHERE c.tenant_id = v_tenant
    AND c.workflow_instance_id IS NOT NULL
    AND (
      c.complaint_no LIKE 'CMP-KPG-%'
      OR c.fhtc_number = 'FHTC-DEMO-001'
      OR c.fhtc_number LIKE 'FHTC-KPG-%'
      OR c.consumer_id = 'CON-PORTAL-00001'
      OR c.om_consumer_id = v_demo_consumer_id
      OR c.om_consumer_id IN (
        SELECT id FROM om_consumers
        WHERE tenant_id = v_tenant
          AND (
            fhtc_number = 'FHTC-DEMO-001'
            OR fhtc_number LIKE 'FHTC-KPG-%'
            OR consumer_name = 'Demo Household Consumer'
            OR consumer_code = 'CON-PORTAL-00001'
          )
      )
      OR c.complaint_no IN (
        'CMP-2026-00001', 'CMP-2026-00002',
        'CMP-2026-00003', 'CMP-2026-00004'
      )
      OR c.id IN (
        'e2000000-0000-0000-0000-000000000001',
        'e2000000-0000-0000-0000-000000000002',
        'e2000000-0000-0000-0000-000000000003'
      )
    );

  -- Workflow instances linked to demo complaints we are about to delete.
  DELETE FROM workflow_instances wi
  WHERE wi.id IN (
    SELECT c.workflow_instance_id
    FROM om_consumer_complaints c
    WHERE c.tenant_id = v_tenant
      AND c.workflow_instance_id IS NOT NULL
      AND (
        c.complaint_no LIKE 'CMP-KPG-%'
        OR c.fhtc_number = 'FHTC-DEMO-001'
        OR c.fhtc_number LIKE 'FHTC-KPG-%'
        OR c.consumer_id = 'CON-PORTAL-00001'
        OR c.om_consumer_id = v_demo_consumer_id
        OR c.om_consumer_id IN (
          SELECT id FROM om_consumers
          WHERE tenant_id = v_tenant
            AND (
              fhtc_number = 'FHTC-DEMO-001'
              OR fhtc_number LIKE 'FHTC-KPG-%'
              OR consumer_name = 'Demo Household Consumer'
              OR consumer_code = 'CON-PORTAL-00001'
            )
        )
        OR c.complaint_no IN (
          'CMP-2026-00001', 'CMP-2026-00002',
          'CMP-2026-00003', 'CMP-2026-00004'
        )
        OR (
          c.complaint_no LIKE 'CMP-2026-%'
          AND (
            c.fhtc_number = 'FHTC-DEMO-001'
            OR c.consumer_id = 'CON-PORTAL-00001'
            OR c.om_consumer_id IN (
              SELECT id FROM om_consumers
              WHERE tenant_id = v_tenant
                AND (
                  fhtc_number = 'FHTC-DEMO-001'
                  OR consumer_name = 'Demo Household Consumer'
                )
            )
          )
        )
        OR c.id IN (
          'e2000000-0000-0000-0000-000000000001',
          'e2000000-0000-0000-0000-000000000002',
          'e2000000-0000-0000-0000-000000000003'
        )
      )
  );
  GET DIAGNOSTICS v_deleted_workflows = ROW_COUNT;

  -- All demo KPG seed complaints + portal CMP-2026-* from Demo Household Consumer.
  DELETE FROM om_consumer_complaints
  WHERE tenant_id = v_tenant
    AND (
      complaint_no LIKE 'CMP-KPG-%'
      OR fhtc_number = 'FHTC-DEMO-001'
      OR fhtc_number LIKE 'FHTC-KPG-%'
      OR consumer_id = 'CON-PORTAL-00001'
      OR om_consumer_id = v_demo_consumer_id
      OR om_consumer_id IN (
        SELECT id FROM om_consumers
        WHERE tenant_id = v_tenant
          AND (
            fhtc_number = 'FHTC-DEMO-001'
            OR fhtc_number LIKE 'FHTC-KPG-%'
            OR consumer_name = 'Demo Household Consumer'
            OR consumer_code = 'CON-PORTAL-00001'
          )
      )
      OR complaint_no IN (
        'CMP-2026-00001', 'CMP-2026-00002',
        'CMP-2026-00003', 'CMP-2026-00004'
      )
      OR (
        complaint_no LIKE 'CMP-2026-%'
        AND (
          fhtc_number = 'FHTC-DEMO-001'
          OR consumer_id = 'CON-PORTAL-00001'
          OR om_consumer_id IN (
            SELECT id FROM om_consumers
            WHERE tenant_id = v_tenant
              AND (
                fhtc_number = 'FHTC-DEMO-001'
                OR consumer_name = 'Demo Household Consumer'
              )
          )
        )
      )
      OR id IN (
        'e2000000-0000-0000-0000-000000000001',
        'e2000000-0000-0000-0000-000000000002',
        'e2000000-0000-0000-0000-000000000003'
      )
    );
  GET DIAGNOSTICS v_deleted_complaints = ROW_COUNT;

  -- Demo portal / KPG placeholder consumers only; real consumers are untouched.
  DELETE FROM om_consumers
  WHERE tenant_id = v_tenant
    AND (
      fhtc_number = 'FHTC-DEMO-001'
      OR fhtc_number LIKE 'FHTC-KPG-%'
      OR consumer_name = 'Demo Household Consumer'
      OR (
        id = v_demo_consumer_id
        AND consumer_code = 'CON-PORTAL-00001'
      )
      OR consumer_code = 'CON-PORTAL-00001'
    );
  GET DIAGNOSTICS v_deleted_consumers = ROW_COUNT;

  RAISE NOTICE 'Part A — demo complaints/consumers: % complaint(s), % notification(s), % workflow(s), % consumer(s) removed',
    v_deleted_complaints, v_deleted_notifs, v_deleted_workflows, v_deleted_consumers;
END $$;

-- Part B: legacy seeded demo projects (092_cleanup_demo_projects.sql logic).
DO $$
DECLARE
  v_tenant              UUID := 'a0000000-0000-0000-0000-000000000001';
  v_deleted_projects    INT;
  v_deleted_complaints  INT;
  v_deleted_consumers   INT;
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
    RAISE NOTICE 'Part B — no legacy demo projects found';
    RETURN;
  END IF;

  CREATE TEMP TABLE tmp_demo_consumers ON COMMIT DROP AS
  SELECT id FROM om_consumers
  WHERE tenant_id = v_tenant
    AND project_id IN (SELECT id FROM tmp_demo_projects);

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

  RAISE NOTICE 'Part B — demo projects: % project(s), % complaint(s), % consumer(s) removed',
    v_deleted_projects, v_deleted_complaints, v_deleted_consumers;
END $$;

-- Verification (should return 0 rows each).
SELECT 'remaining_cmp_kpg' AS check, COUNT(*) AS n
FROM om_consumer_complaints
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND complaint_no LIKE 'CMP-KPG-%'
UNION ALL
SELECT 'remaining_cmp_2026_demo', COUNT(*)
FROM om_consumer_complaints c
WHERE c.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND c.complaint_no LIKE 'CMP-2026-%'
  AND (
    c.fhtc_number = 'FHTC-DEMO-001'
    OR c.consumer_id = 'CON-PORTAL-00001'
    OR c.fhtc_number LIKE 'FHTC-KPG-%'
  )
UNION ALL
SELECT 'remaining_demo_consumer', COUNT(*)
FROM om_consumers
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND (
    fhtc_number = 'FHTC-DEMO-001'
    OR fhtc_number LIKE 'FHTC-KPG-%'
    OR consumer_name = 'Demo Household Consumer'
  )
UNION ALL
SELECT 'remaining_zone_a_project', COUNT(*)
FROM projects
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND (
    project_code IN ('PRJ-2025-001', 'PRJ-ZAPR-2025-26')
    OR id = 'f0000000-0000-0000-0000-000000000001'
  )
UNION ALL
SELECT 'remaining_f0000000_seed_projects', COUNT(*)
FROM projects
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND id::text LIKE 'f0000000-0000-0000-0000-0000000000%';
