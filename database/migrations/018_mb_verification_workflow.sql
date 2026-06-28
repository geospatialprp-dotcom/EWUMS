-- Stage 4: MB Verification — AE verifies, EE final approval (Contractor → JE → AE → EE)
UPDATE workflow_definitions SET
  description = 'Stage 4: AE verifies MB entries, site, quantities, drawings → EE final technical & quantity approval.',
  steps = '[
    {"order":1,"name":"AE Verification","role":"ae","action":"verify"},
    {"order":2,"name":"EE Final Approval","role":"ee","action":"approve"}
  ]'::jsonb
WHERE code = 'mb_submit';
