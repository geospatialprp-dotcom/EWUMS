-- Move legacy submitted MBs into AE verification queue (Stage 4)
UPDATE measurement_books
SET status = 'ae_checked'
WHERE status IN ('je_review', 'in_review');

-- Reassign pending JE measurement tasks on MB workflows to AE
UPDATE workflow_tasks t
SET assigned_role = 'ae',
    step_name = 'AE Verification'
FROM workflow_instances i
JOIN workflow_definitions d ON d.id = i.definition_id
WHERE t.instance_id = i.id
  AND t.status = 'pending'
  AND d.code = 'mb_submit'
  AND t.assigned_role = 'je';
