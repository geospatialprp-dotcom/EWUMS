-- Repair draft DPRs saved with header only (no dpr_activities rows).
--
-- Finds draft/rejected DPRs with zero activities but a work_package_id, then inserts
-- activity rows from the work package component + first matching L1 Contractor BOQ item.
--
-- Run from deploy/hostinger-kvm/:
--   docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
--     psql -U "${DB_USERNAME:-egip}" -d "${DB_DATABASE:-egip}" -v ON_ERROR_STOP=1 \
--     < ../../database/scripts/vps-repair-dpr-activities.sql

DO $$
DECLARE
  v_dpr          RECORD;
  v_wp           RECORD;
  v_boq          RECORD;
  v_financial    TEXT;
  v_inserted     INT := 0;
BEGIN
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM boq_items
      WHERE is_active = TRUE AND boq_source = 'l1_contractor'
      LIMIT 1
    ) THEN 'l1_contractor'
    ELSE 'government'
  END INTO v_financial;

  FOR v_dpr IN
    SELECT d.id, d.tenant_id, d.project_id, d.work_package_id, d.scheme_type
    FROM dpr_reports d
    WHERE d.status IN ('draft', 'rejected')
      AND d.work_package_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM dpr_activities a WHERE a.dpr_id = d.id
      )
  LOOP
    SELECT wp.id, wp.component, wp.chainage_from, wp.chainage_to
    INTO v_wp
    FROM work_packages wp
    WHERE wp.id = v_dpr.work_package_id
      AND wp.tenant_id = v_dpr.tenant_id
      AND wp.project_id = v_dpr.project_id;

    IF NOT FOUND THEN
      RAISE NOTICE 'DPR % — work package % not found, skipping', v_dpr.id, v_dpr.work_package_id;
      CONTINUE;
    END IF;

    SELECT b.id, b.item_code, b.description, b.unit,
           COALESCE(b.measurement_mode, 'discrete_qty') AS measurement_mode
    INTO v_boq
    FROM boq_items b
    WHERE b.tenant_id = v_dpr.tenant_id
      AND b.project_id = v_dpr.project_id
      AND b.is_active = TRUE
      AND b.boq_source = v_financial
      AND (b.scheme_type IS NULL OR b.scheme_type = v_dpr.scheme_type)
      AND (v_wp.component IS NULL OR b.component IS NULL OR b.component = v_wp.component)
    ORDER BY b.sort_order ASC, b.item_code ASC
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE NOTICE 'DPR % — no matching BOQ item for component %, skipping',
        v_dpr.id, v_wp.component;
      CONTINUE;
    END IF;

    INSERT INTO dpr_activities (
      dpr_id, activity_code, description, unit, quantity_done,
      boq_item_id, component, chainage_from, chainage_to,
      progress_mode, work_done_today, sort_order
    ) VALUES (
      v_dpr.id,
      v_boq.item_code,
      v_boq.description,
      v_boq.unit,
      0,
      v_boq.id,
      v_wp.component,
      v_wp.chainage_from,
      v_wp.chainage_to,
      v_boq.measurement_mode,
      v_boq.description,
      0
    );

    v_inserted := v_inserted + 1;
    RAISE NOTICE 'DPR % — inserted activity from BOQ % (%)',
      v_dpr.id, v_boq.item_code, v_boq.description;
  END LOOP;

  RAISE NOTICE 'Repair complete — % DPR(s) updated', v_inserted;
END $$;
