-- Freeze TAC Round 1 official DPR for Secretariat Stage 7 (Tharali demo)
-- Secretariat may ONLY review this frozen PDF — not later division uploads.
-- Run from deploy/hostinger-kvm/:
--   docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
--     psql -U egip -d egip -v ON_ERROR_STOP=1 < ../../database/scripts/vps-freeze-tac1-official.sql

WITH p AS (
  SELECT id FROM dpr_proposals WHERE proposal_no = 'DPRP-2026-27-KPG-0001'
),
doc AS (
  SELECT d.id, d.version_no, d.file_name
  FROM dpr_proposal_documents d
  JOIN p ON d.proposal_id = p.id
  WHERE d.document_type = 'dpr_complete_pdf'
  ORDER BY d.version_no DESC
  LIMIT 1
)
UPDATE dpr_proposals pr
SET hq_verification = jsonb_set(
  COALESCE(pr.hq_verification, '{}'::jsonb),
  '{tacRound1,officialPackage}',
  jsonb_build_object(
    'documentId', doc.id,
    'versionNo', doc.version_no,
    'fileName', doc.file_name,
    'frozenAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'source', 'tac_round1_cleared',
    'label', 'TAC Round 1 — Reviewed DPR (official)'
  ),
  true
)
FROM p, doc
WHERE pr.id = p.id
RETURNING pr.proposal_no, pr.hq_verification->'tacRound1'->'officialPackage' AS tac1_official;
