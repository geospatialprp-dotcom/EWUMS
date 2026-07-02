-- Rebuild sanctioned official package labels for TAC Round 2 (Tharali demo).
-- Clears stale "TAC Round 1" DPR label — API auto-rebuilds on next proposal open.
--
-- Run from deploy/hostinger-kvm/:
--   docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
--     psql -U egip -d egip -v ON_ERROR_STOP=1 < ../../database/scripts/vps-rebuild-sanctioned-round2-package.sql

UPDATE dpr_proposals
SET hq_verification = hq_verification - 'sanctionedOfficialPackage'
WHERE proposal_no = 'DPRP-2026-27-KPG-0001'
  AND status IN ('sanctioned', 'tender_prep_initiated', 'tender_processing', 'tender_published');

SELECT proposal_no, status,
       hq_verification->'sanctionedOfficialPackage'->'round' AS pkg_round,
       hq_verification->'sanctionedOfficialPackage'->'items'->0->>'label' AS first_doc_label
FROM dpr_proposals
WHERE proposal_no = 'DPRP-2026-27-KPG-0001';
