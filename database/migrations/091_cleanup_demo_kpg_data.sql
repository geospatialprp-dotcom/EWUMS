-- Migration 091: Remove ALL KPG / portal demo complaints and demo consumers.
-- Idempotent — safe to run multiple times. Pair with 092 for legacy demo project removal.
--
-- Covers: CMP-KPG-%, CMP-2026-* (portal demo), FHTC-DEMO-001, FHTC-KPG-*, Demo Household Consumer.
-- Migrations 087/088 are OPTIONAL demo seeds (kept in repo history only).
-- Standalone copy: database/scripts/cleanup-demo-kpg-data.sql

DO $$
DECLARE
  v_tenant              UUID := 'a0000000-0000-0000-0000-000000000001';
  v_demo_consumer_id    UUID := 'c1000000-0000-0000-0000-000000000001';
  v_deleted_complaints  INT;
  v_deleted_notifs      INT;
  v_deleted_workflows   INT;
  v_deleted_consumers   INT;
BEGIN
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

  RAISE NOTICE '091 demo cleanup: % complaint(s), % notification(s), % workflow(s), % consumer(s) removed',
    v_deleted_complaints, v_deleted_notifs, v_deleted_workflows, v_deleted_consumers;
END $$;
