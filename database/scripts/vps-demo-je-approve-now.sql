-- Emergency: force JE approval on latest Tharali handover (demo unblock).
-- Does NOT require new web UI. Run on VPS only:
--   bash /opt/egip/database/scripts/vps-demo-je-approve-now.sh

UPDATE om_handover_documents d
SET status = 'approved',
    approved_at = COALESCE(approved_at, NOW()),
    updated_at = NOW()
FROM om_handover h
WHERE d.handover_id = h.id
  AND h.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND h.status = 'je_review'
  AND h.scheme_name ILIKE '%Tharali%'
  AND d.source = 'upload'
  AND d.status <> 'approved';

WITH target AS (
  SELECT h.id AS handover_id,
         wi.id AS instance_id,
         t.id AS task_id
  FROM om_handover h
  JOIN workflow_instances wi ON wi.id = h.workflow_instance_id
  JOIN workflow_tasks t
    ON t.instance_id = wi.id
   AND t.status = 'pending'
   AND t.assigned_role = 'je'
  WHERE h.tenant_id = 'a0000000-0000-0000-0000-000000000001'
    AND h.status = 'je_review'
    AND h.scheme_name ILIKE '%Tharali%'
  ORDER BY h.created_at DESC
  LIMIT 1
)
UPDATE workflow_tasks wt
SET status = 'approved',
    comments = 'Demo emergency JE approve',
    acted_at = NOW()
FROM target
WHERE wt.id = target.task_id;

WITH target AS (
  SELECT wi.id AS instance_id
  FROM om_handover h
  JOIN workflow_instances wi ON wi.id = h.workflow_instance_id
  WHERE h.tenant_id = 'a0000000-0000-0000-0000-000000000001'
    AND h.status = 'je_review'
    AND h.scheme_name ILIKE '%Tharali%'
  ORDER BY h.created_at DESC
  LIMIT 1
)
UPDATE workflow_instances wi
SET current_step = 2,
    updated_at = NOW()
FROM target
WHERE wi.id = target.instance_id;

INSERT INTO workflow_tasks (instance_id, step_order, step_name, assigned_role, status)
SELECT wi.id, 2, 'AE Approval', 'ae', 'pending'
FROM om_handover h
JOIN workflow_instances wi ON wi.id = h.workflow_instance_id
WHERE h.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND h.status = 'je_review'
  AND h.scheme_name ILIKE '%Tharali%'
  AND wi.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM workflow_tasks t
    WHERE t.instance_id = wi.id AND t.status = 'pending'
  )
ORDER BY h.created_at DESC
LIMIT 1;

UPDATE om_handover h
SET status = 'ae_review',
    updated_at = NOW()
WHERE h.tenant_id = 'a0000000-0000-0000-0000-000000000001'
  AND h.status = 'je_review'
  AND h.scheme_name ILIKE '%Tharali%';

SELECT h.scheme_name, h.status AS handover_status, wi.current_step,
       t.assigned_role, t.status AS task_status
FROM om_handover h
LEFT JOIN workflow_instances wi ON wi.id = h.workflow_instance_id
LEFT JOIN workflow_tasks t ON t.instance_id = wi.id AND t.status = 'pending'
WHERE h.scheme_name ILIKE '%Tharali%'
ORDER BY h.created_at DESC
LIMIT 3;
