#!/usr/bin/env bash
# ONE-SHOT VPS deploy for Secretariat Stage 7 (use when main is still old).
# Run on VPS as root:
#   bash /opt/egip/database/scripts/vps-deploy-feat-secretariat.sh
set -euo pipefail

ROOT="/opt/egip"
BRANCH="feat/secretariat-stage7-tac1-freeze"
DEPLOY="${ROOT}/deploy/hostinger-kvm"
COMPOSE=(docker compose -f "${DEPLOY}/docker-compose.prod.yml" --env-file "${DEPLOY}/.env")

echo "==> 1. Pull branch ${BRANCH} (NOT main — fixes are only on this branch)"
cd "${ROOT}"
sudo -u egip git fetch origin "${BRANCH}"
sudo -u egip git checkout "${BRANCH}"
sudo -u egip git pull --ff-only origin "${BRANCH}"
echo "    Commit: $(git rev-parse --short HEAD) $(git log -1 --format='%s')"

echo "==> 2. Secretariat user + permissions (097)"
"${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 \
  < "${ROOT}/database/migrations/097_secretariat_dpr_role.sql"

echo "==> 3. Freeze TAC1 official PDF for Tharali demo"
"${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 \
  < "${ROOT}/database/scripts/vps-freeze-tac1-official.sql" || echo "WARN: freeze skipped (no dpr_complete_pdf?)"

echo "==> 4. Rebuild API + Web"
cd "${DEPLOY}"
"${COMPOSE[@]}" build api web
"${COMPOSE[@]}" up -d api web

echo ""
echo "==> 5. Verify"
"${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -c "
SELECT proposal_no, status, current_stage,
       hq_verification->'tacRound1'->'officialPackage'->>'fileName' AS tac1_pdf
FROM dpr_proposals WHERE proposal_no = 'DPRP-2026-27-KPG-0001';"

echo ""
echo "DONE."
echo "  1) Log OUT in browser"
echo "  2) Log IN: secretariat@egip.local / Sec@123"
echo "  3) Ctrl+Shift+R"
echo "  4) Stage 7 -> Review TAC1 Official DPR Online"
