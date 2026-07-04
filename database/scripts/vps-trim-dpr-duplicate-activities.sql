-- Remove extra dpr_activities rows (keep one primary line per DPR).
-- Fixes list tables that showed SD-1.01..SD-1.04 as separate rows for one daily report.
--
-- Run from deploy/hostinger-kvm/:
--   docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
--     psql -U "${DB_USERNAME:-egip}" -d "${DB_DATABASE:-egip}" -v ON_ERROR_STOP=1 \
--     < ../../database/scripts/vps-trim-dpr-duplicate-activities.sql

WITH ranked AS (
  SELECT
    a.id,
    a.dpr_id,
    ROW_NUMBER() OVER (
      PARTITION BY a.dpr_id
      ORDER BY
        CASE WHEN a.boq_item_id IS NOT NULL THEN 0 ELSE 1 END,
        a.sort_order ASC,
        a.created_at ASC NULLS LAST,
        a.id ASC
    ) AS rn
  FROM dpr_activities a
),
to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM dpr_activities a
WHERE a.id IN (SELECT id FROM to_delete);

-- Back-fill missing DPR numbers on draft/rejected reports
WITH numbered AS (
  SELECT
    d.id,
    ROW_NUMBER() OVER (
      PARTITION BY d.tenant_id, d.project_id
      ORDER BY d.report_date ASC, d.created_at ASC NULLS LAST, d.id ASC
    ) AS seq
  FROM dpr_reports d
  WHERE d.status IN ('draft', 'rejected')
    AND (d.dpr_number IS NULL OR TRIM(d.dpr_number) = '')
)
UPDATE dpr_reports d
SET dpr_number = numbered.seq::text
FROM numbered
WHERE d.id = numbered.id;

-- Verification
SELECT d.dpr_number, d.report_date, d.status, COUNT(a.id) AS activity_count
FROM dpr_reports d
LEFT JOIN dpr_activities a ON a.dpr_id = d.id
WHERE d.tenant_id = 'a0000000-0000-0000-0000-000000000001'
GROUP BY d.id, d.dpr_number, d.report_date, d.status
ORDER BY d.dpr_number;
