-- Check Tharali DPR status + EE assignment (run on VPS)
SELECT proposal_no,
       status,
       current_stage,
       hq_verification->'eeComplianceAssignment'->>'assignedAt' AS ee_assigned_at,
       hq_verification->'eeComplianceAssignment'->>'acknowledgedAt' AS ee_ack_at,
       hq_verification->'tacRound2'->>'lastAction' AS tac2_last_action
FROM dpr_proposals
WHERE proposal_no = 'DPRP-2026-27-KPG-0001';

-- Expected for EE compliance button:
--   status = tac_round2_corrections_required  (or tac_round2_compliance after EE begins)
-- If still tac_round2_review, Secretariat has not requested compliance yet.
