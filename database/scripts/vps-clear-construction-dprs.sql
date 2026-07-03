-- Clear contractor daily DPR test entries (dpr_reports) for Tharali / KPG demo.
-- Keeps: work packages, contractors, BOQ items, DPR proposal pipeline, LA case, project.
--
-- Run from deploy/hostinger-kvm/:
--   docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
--     psql -U "${DB_USERNAME:-egip}" -d "${DB_DATABASE:-egip}" -v ON_ERROR_STOP=1 \
--     < ../../database/scripts/vps-clear-construction-dprs.sql

DO $$
DECLARE
  v_tenant       UUID := 'a0000000-0000-0000-0000-000000000001';
  v_dpr_deleted  INT := 0;
  v_wf_deleted   INT := 0;
  v_docs_deleted INT := 0;
  v_alerts_deleted INT := 0;
BEGIN
  CREATE TEMP TABLE tmp_dpr_projects ON COMMIT DROP AS
  SELECT DISTINCT dr.project_id
  FROM dpr_reports dr
  WHERE dr.tenant_id = v_tenant;

  RAISE NOTICE 'Target project(s): %', (SELECT string_agg(project_id::text, ', ') FROM tmp_dpr_projects);

  IF NOT EXISTS (SELECT 1 FROM tmp_dpr_projects) THEN
    RAISE NOTICE 'No target projects found — nothing to clear';
    RETURN;
  END IF;

  CREATE TEMP TABLE tmp_dpr_ids ON COMMIT DROP AS
  SELECT dr.id AS dpr_id, dr.workflow_instance_id
  FROM dpr_reports dr
  WHERE dr.tenant_id = v_tenant
    AND dr.project_id IN (SELECT project_id FROM tmp_dpr_projects);

  IF NOT EXISTS (SELECT 1 FROM tmp_dpr_ids) THEN
    RAISE NOTICE 'No daily DPR rows on target projects — already clean';
    RETURN;
  END IF;

  DELETE FROM construction_documents cd
  WHERE cd.tenant_id = v_tenant
    AND cd.resource_type = 'dpr'
    AND cd.resource_id IN (SELECT dpr_id FROM tmp_dpr_ids);
  GET DIAGNOSTICS v_docs_deleted = ROW_COUNT;

  UPDATE measurement_books
  SET dpr_id = NULL
  WHERE tenant_id = v_tenant
    AND project_id IN (SELECT project_id FROM tmp_dpr_projects)
    AND dpr_id IN (SELECT dpr_id FROM tmp_dpr_ids);

  UPDATE dpr_reports
  SET workflow_instance_id = NULL
  WHERE id IN (SELECT dpr_id FROM tmp_dpr_ids);

  DELETE FROM workflow_instances wi
  WHERE wi.tenant_id = v_tenant
    AND (
      wi.id IN (SELECT workflow_instance_id FROM tmp_dpr_ids WHERE workflow_instance_id IS NOT NULL)
      OR (
        wi.resource_type = 'dpr'
        AND wi.resource_id IN (SELECT dpr_id FROM tmp_dpr_ids)
      )
    );
  GET DIAGNOSTICS v_wf_deleted = ROW_COUNT;

  DELETE FROM dpr_reports dr
  WHERE dr.id IN (SELECT dpr_id FROM tmp_dpr_ids);
  GET DIAGNOSTICS v_dpr_deleted = ROW_COUNT;

  UPDATE boq_items
  SET dpr_qty = 0
  WHERE tenant_id = v_tenant
    AND project_id IN (SELECT project_id FROM tmp_dpr_projects);

  DELETE FROM om_alert_notifications
  WHERE tenant_id = v_tenant
    AND event_type IN ('workflow_pending_approval', 'workflow_pending');
  GET DIAGNOSTICS v_alerts_deleted = ROW_COUNT;

  RAISE NOTICE 'Cleared % daily DPR(s), % workflow instance(s), % document(s), % notification log row(s)',
    v_dpr_deleted, v_wf_deleted, v_docs_deleted, v_alerts_deleted;
END $$;

-- Verification — should return 0 rows
SELECT dr.dpr_number, dr.report_date, dr.status, dr.contractor_name, dr.project_id
FROM dpr_reports dr
WHERE dr.tenant_id = 'a0000000-0000-0000-0000-000000000001'
ORDER BY dr.dpr_number;
