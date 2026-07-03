-- DPR workflow: after AE approval status must be ee_review (not ee_approved) until EE acts.
UPDATE dpr_reports d
SET status = 'ee_review'
FROM workflow_instances wi
WHERE d.workflow_instance_id = wi.id
  AND wi.status = 'pending'
  AND wi.current_step = 3
  AND d.status = 'ee_approved';
