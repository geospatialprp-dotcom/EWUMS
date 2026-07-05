-- Repair over-counted whole-job (Job / LS / Item) DPR quantities from demo data.
-- Snaps quantity_done to 0.5 steps and caps boq_items.dpr_qty at sanctioned qty.
--
-- Run from deploy/hostinger-kvm/:
--   docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
--     psql -U "${DB_USERNAME:-egip}" -d "${DB_DATABASE:-egip}" -v ON_ERROR_STOP=1 \
--     < ../../database/scripts/vps-repair-job-unit-dpr-qty.sql

BEGIN;

-- Preview rows that will change
SELECT 'dpr_activities (before)' AS stage, a.id, a.activity_code, a.quantity_done, a.progress_mode
FROM dpr_activities a
WHERE a.progress_mode = 'whole_job'
  AND a.quantity_done <> ROUND(LEAST(GREATEST(a.quantity_done, 0), 9999) * 2) / 2;

-- Snap activity qty to 0, 0.5, 1 … capped at linked BOQ sanctioned qty
UPDATE dpr_activities a
SET quantity_done = sub.snapped
FROM (
  SELECT
    a2.id,
    CASE
      WHEN a2.quantity_done <= 0 THEN 0
      ELSE LEAST(
        ROUND(LEAST(GREATEST(a2.quantity_done, 0), COALESCE(NULLIF(b.revised_qty, 0), b.contract_qty, 1)) * 2) / 2,
        COALESCE(NULLIF(b.revised_qty, 0), b.contract_qty, 1)
      )
    END AS snapped
  FROM dpr_activities a2
  LEFT JOIN boq_items b ON b.id = a2.boq_item_id
  WHERE a2.progress_mode = 'whole_job'
) sub
WHERE a.id = sub.id
  AND a.quantity_done IS DISTINCT FROM sub.snapped;

-- Cap BOQ-level cumulative DPR qty (e.g. 2.54 → 2 for SD-1.02)
UPDATE boq_items b
SET dpr_qty = LEAST(
  b.dpr_qty,
  COALESCE(NULLIF(b.revised_qty, 0), b.contract_qty)
)
WHERE b.measurement_mode = 'whole_job'
  AND b.dpr_qty > COALESCE(NULLIF(b.revised_qty, 0), b.contract_qty);

-- Refresh execution ledger cumulative from approved DPR activities
UPDATE dpr_boq_execution e
SET
  cumulative_qty = sub.total,
  cumulative_pct = CASE
    WHEN e.sanctioned_qty > 0 THEN LEAST(100, ROUND((sub.total / e.sanctioned_qty) * 10000) / 100)
    ELSE 0
  END,
  status = CASE
    WHEN e.sanctioned_qty > 0 AND sub.total >= e.sanctioned_qty THEN 'completed'
    WHEN sub.total > 0 THEN 'in_progress'
    ELSE 'not_started'
  END,
  updated_at = NOW()
FROM (
  SELECT
    l.scope_key,
    l.project_id,
    SUM(l.delta_qty) FILTER (WHERE l.reversed_at IS NULL) AS total
  FROM dpr_boq_progress_ledger l
  JOIN dpr_reports d ON d.id = l.dpr_id AND d.status = 'approved'
  GROUP BY l.scope_key, l.project_id
) sub
WHERE e.scope_key = sub.scope_key
  AND e.project_id = sub.project_id;

UPDATE boq_items b
SET dpr_execution_status = CASE
  WHEN b.dpr_qty >= COALESCE(NULLIF(b.revised_qty, 0), b.contract_qty)
       AND COALESCE(NULLIF(b.revised_qty, 0), b.contract_qty) > 0 THEN 'completed'
  WHEN b.dpr_qty > 0 THEN 'in_progress'
  ELSE 'not_started'
END
WHERE b.measurement_mode = 'whole_job';

COMMIT;

SELECT b.item_code, b.unit, b.contract_qty, b.dpr_qty, b.dpr_execution_status
FROM boq_items b
WHERE b.measurement_mode = 'whole_job'
ORDER BY b.item_code;
