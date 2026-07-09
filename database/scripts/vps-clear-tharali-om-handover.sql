-- Clear O&M handover records for Tharali demo (fresh contractor initiation).
-- Removes handover rows, e-DMS documents, and linked workflow instances/tasks.
--
-- Run on VPS:
--   docker compose -f /opt/egip/deploy/hostinger-kvm/docker-compose.prod.yml \
--     --env-file /opt/egip/deploy/hostinger-kvm/.env exec -T postgres \
--     psql -U egip -d egip -v ON_ERROR_STOP=1 \
--     < /opt/egip/database/scripts/vps-clear-tharali-om-handover.sql

DO $$
DECLARE
  v_tenant    UUID := 'a0000000-0000-0000-0000-000000000001';
  v_project   UUID;
  v_handover  INT := 0;
  v_docs      INT := 0;
  v_wf        INT := 0;
BEGIN
  SELECT id INTO v_project
  FROM projects
  WHERE tenant_id = v_tenant
    AND (
      project_code = 'PRJ-TPPWSS-2026-27'
      OR name ILIKE '%Tharali%'
    )
  ORDER BY CASE WHEN project_code = 'PRJ-TPPWSS-2026-27' THEN 0 ELSE 1 END
  LIMIT 1;

  CREATE TEMP TABLE tmp_handover_clear ON COMMIT DROP AS
  SELECT h.id, h.workflow_instance_id, h.scheme_name, h.status
  FROM om_handover h
  WHERE h.tenant_id = v_tenant
    AND (
      (v_project IS NOT NULL AND h.project_id = v_project)
      OR h.scheme_name ILIKE '%Tharali%'
    );

  IF NOT EXISTS (SELECT 1 FROM tmp_handover_clear) THEN
    RAISE NOTICE 'No Tharali O&M handover records found — already clean';
    RETURN;
  END IF;

  UPDATE assets
  SET handover_id = NULL
  WHERE handover_id IN (SELECT id FROM tmp_handover_clear);

  DELETE FROM om_handover_documents
  WHERE handover_id IN (SELECT id FROM tmp_handover_clear);
  GET DIAGNOSTICS v_docs = ROW_COUNT;

  UPDATE om_handover
  SET workflow_instance_id = NULL
  WHERE id IN (SELECT id FROM tmp_handover_clear);

  DELETE FROM workflow_instances wi
  WHERE wi.tenant_id = v_tenant
    AND (
      wi.id IN (SELECT workflow_instance_id FROM tmp_handover_clear WHERE workflow_instance_id IS NOT NULL)
      OR (
        wi.resource_type = 'om_handover'
        AND wi.resource_id IN (SELECT id FROM tmp_handover_clear)
      )
    );
  GET DIAGNOSTICS v_wf = ROW_COUNT;

  DELETE FROM om_handover
  WHERE id IN (SELECT id FROM tmp_handover_clear);
  GET DIAGNOSTICS v_handover = ROW_COUNT;

  DELETE FROM om_alert_notifications
  WHERE tenant_id = v_tenant
    AND event_type IN ('workflow_pending_approval', 'workflow_pending');

  RAISE NOTICE 'Cleared % handover(s), % document(s), % workflow instance(s) for Tharali demo',
    v_handover, v_docs, v_wf;
END $$;

SELECT scheme_name, status, created_at
FROM om_handover h
WHERE h.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND h.scheme_name ILIKE '%Tharali%'
ORDER BY h.created_at DESC;
