-- Remove Nainital demo scheme: Badhangarhi Water Supply Scheme (PRJ-BWSS-2026-27).
-- Safe to re-run. Keeps Tharali / Karanprayag production demo data.
--
-- VPS:
--   docker compose -f /opt/egip/deploy/hostinger-kvm/docker-compose.prod.yml exec -T postgres \
--     psql -U egip -d egip -v ON_ERROR_STOP=1 < /opt/egip/database/scripts/vps-remove-badhangarhi-scheme.sql

DO $$
DECLARE
  v_tenant           UUID := 'a0000000-0000-0000-0000-000000000001';
  v_deleted_projects INT;
BEGIN
  CREATE TEMP TABLE tmp_bwss_projects ON COMMIT DROP AS
  SELECT id, project_code, name
  FROM projects
  WHERE tenant_id = v_tenant
    AND (
      id = 'f0000000-0000-0000-0000-000000000020'
      OR project_code = 'PRJ-BWSS-2026-27'
      OR name ILIKE '%Badhangarhi%'
    );

  IF NOT EXISTS (SELECT 1 FROM tmp_bwss_projects) THEN
    RAISE NOTICE 'Badhangarhi scheme not found — already removed';
    RETURN;
  END IF;

  RAISE NOTICE 'Removing: %', (SELECT string_agg(project_code || ' — ' || name, '; ') FROM tmp_bwss_projects);

  DELETE FROM project_deletion_requests
  WHERE project_id IN (SELECT id FROM tmp_bwss_projects);

  UPDATE dpr_proposals
  SET project_id = NULL
  WHERE project_id IN (SELECT id FROM tmp_bwss_projects);

  UPDATE la_cases
  SET project_id = NULL
  WHERE project_id IN (SELECT id FROM tmp_bwss_projects);

  CREATE TEMP TABLE tmp_bwss_consumers ON COMMIT DROP AS
  SELECT id FROM om_consumers
  WHERE tenant_id = v_tenant
    AND project_id IN (SELECT id FROM tmp_bwss_projects);

  DELETE FROM om_billing_payments WHERE consumer_id IN (SELECT id FROM tmp_bwss_consumers);
  DELETE FROM om_consumer_bills WHERE consumer_id IN (SELECT id FROM tmp_bwss_consumers);
  DELETE FROM om_meter_readings WHERE consumer_id IN (SELECT id FROM tmp_bwss_consumers);
  DELETE FROM om_consumer_notifications WHERE consumer_id IN (SELECT id FROM tmp_bwss_consumers);

  DELETE FROM workflow_instances wi
  WHERE wi.id IN (
    SELECT c.workflow_instance_id
    FROM om_consumer_complaints c
    WHERE c.workflow_instance_id IS NOT NULL
      AND (
        c.project_id IN (SELECT id FROM tmp_bwss_projects)
        OR c.om_consumer_id IN (SELECT id FROM tmp_bwss_consumers)
      )
  );

  DELETE FROM om_consumer_complaints
  WHERE project_id IN (SELECT id FROM tmp_bwss_projects)
     OR om_consumer_id IN (SELECT id FROM tmp_bwss_consumers);

  DELETE FROM om_consumers WHERE id IN (SELECT id FROM tmp_bwss_consumers);

  DELETE FROM om_contracts WHERE project_id IN (SELECT id FROM tmp_bwss_projects);
  DELETE FROM om_asset_lifecycle_assessments WHERE project_id IN (SELECT id FROM tmp_bwss_projects);
  DELETE FROM om_renewal_plans WHERE project_id IN (SELECT id FROM tmp_bwss_projects);
  DELETE FROM om_pm_schedules WHERE project_id IN (SELECT id FROM tmp_bwss_projects);
  DELETE FROM om_energy_readings WHERE project_id IN (SELECT id FROM tmp_bwss_projects);

  UPDATE dpr_reports SET workflow_instance_id = NULL
  WHERE project_id IN (SELECT id FROM tmp_bwss_projects);
  UPDATE measurement_books SET workflow_instance_id = NULL
  WHERE project_id IN (SELECT id FROM tmp_bwss_projects);
  UPDATE contractor_invoices SET workflow_instance_id = NULL
  WHERE project_id IN (SELECT id FROM tmp_bwss_projects);
  UPDATE ra_bills SET workflow_instance_id = NULL
  WHERE project_id IN (SELECT id FROM tmp_bwss_projects);

  DELETE FROM workflow_instances
  WHERE resource_type = 'project'
    AND resource_id IN (SELECT id FROM tmp_bwss_projects);

  UPDATE measurement_books SET work_package_id = NULL
  WHERE project_id IN (SELECT id FROM tmp_bwss_projects);
  UPDATE dpr_reports SET work_package_id = NULL
  WHERE project_id IN (SELECT id FROM tmp_bwss_projects);

  DELETE FROM work_packages WHERE project_id IN (SELECT id FROM tmp_bwss_projects);

  DELETE FROM ra_bill_lines
  WHERE ra_bill_id IN (SELECT id FROM ra_bills WHERE project_id IN (SELECT id FROM tmp_bwss_projects));

  DELETE FROM ra_bills WHERE project_id IN (SELECT id FROM tmp_bwss_projects);

  DELETE FROM projects WHERE id IN (SELECT id FROM tmp_bwss_projects);
  GET DIAGNOSTICS v_deleted_projects = ROW_COUNT;

  RAISE NOTICE 'Removed % Badhangarhi project(s)', v_deleted_projects;
END $$;

SELECT project_code, name, status
FROM projects
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND (project_code = 'PRJ-BWSS-2026-27' OR name ILIKE '%Badhangarhi%');
