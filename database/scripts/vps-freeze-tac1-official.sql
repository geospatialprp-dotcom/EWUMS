-- Freeze TAC Round 1 official DPR for Secretariat Stage 7 (Tharali demo)
-- Uses the PDF version Super Admin reviewed online (hq scope, max annotations), NOT the latest EE upload.
-- Run from deploy/hostinger-kvm/:
--   docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
--     psql -U egip -d egip -v ON_ERROR_STOP=1 < ../../database/scripts/vps-freeze-tac1-official.sql

WITH p AS (
  SELECT id FROM dpr_proposals WHERE proposal_no = 'DPRP-2026-27-KPG-0001'
),
annotated_docs AS (
  SELECT
    d.id,
    d.version_no,
    d.file_name,
    COUNT(a.id) AS hq_annotation_count,
    MAX(r.updated_at) AS last_review_at
  FROM dpr_pdf_reviews r
  JOIN dpr_proposal_documents d ON d.id = r.document_id
  JOIN p ON r.proposal_id = p.id
  LEFT JOIN dpr_pdf_annotations a ON a.review_id = r.id AND a.tenant_id = r.tenant_id
  WHERE d.document_type = 'dpr_complete_pdf'
    AND r.reviewer_scope = 'hq'
  GROUP BY d.id, d.version_no, d.file_name
),
reviewed_doc AS (
  SELECT id, version_no, file_name
  FROM annotated_docs
  ORDER BY hq_annotation_count DESC, version_no DESC, last_review_at DESC
  LIMIT 1
),
fallback_doc AS (
  SELECT d.id, d.version_no, d.file_name
  FROM dpr_proposal_documents d
  JOIN p ON d.proposal_id = p.id
  WHERE d.document_type = 'dpr_complete_pdf'
  ORDER BY d.version_no DESC
  LIMIT 1
),
doc AS (
  SELECT id, version_no, file_name FROM reviewed_doc
  UNION ALL
  SELECT id, version_no, file_name FROM fallback_doc
  WHERE NOT EXISTS (SELECT 1 FROM reviewed_doc)
  LIMIT 1
)
UPDATE dpr_proposals pr
SET hq_verification = jsonb_set(
  jsonb_set(
    COALESCE(pr.hq_verification, '{}'::jsonb),
    '{tacRound1,reviewedDocumentId}',
    to_jsonb(doc.id::text),
    true
  ),
  '{tacRound1,officialPackage}',
  jsonb_build_object(
    'documentId', doc.id,
    'versionNo', doc.version_no,
    'fileName', doc.file_name,
    'frozenAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'source', 'tac_round1_cleared',
    'label', 'TAC Round 1 — Reviewed DPR (official)',
    'copiedFromDocumentId', doc.id,
    'copiedFromVersionNo', doc.version_no,
    'reviewedDocumentId', doc.id
  ),
  true
)
FROM p, doc
WHERE pr.id = p.id
RETURNING pr.proposal_no,
          pr.hq_verification->'tacRound1'->>'reviewedDocumentId' AS reviewed_doc_id,
          pr.hq_verification->'tacRound1'->'officialPackage'->>'documentId' AS frozen_doc_id,
          pr.hq_verification->'tacRound1'->'officialPackage'->>'copiedFromVersionNo' AS source_version,
          pr.hq_verification->'tacRound1'->'officialPackage'->>'fileName' AS frozen_file;
