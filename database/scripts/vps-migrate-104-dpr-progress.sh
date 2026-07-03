#!/usr/bin/env bash
# Apply migration 104 — required after API commit 9ab2350+ (whole-job DPR progress).
# Run on VPS:
#   bash /opt/egip/database/scripts/vps-migrate-104-dpr-progress.sh
set -euo pipefail

ROOT="/opt/egip"
DEPLOY="${ROOT}/deploy/hostinger-kvm"
COMPOSE=(docker compose -f "${DEPLOY}/docker-compose.prod.yml" --env-file "${DEPLOY}/.env")
MIG="${ROOT}/database/migrations/104_dpr_whole_job_progress.sql"

if [[ ! -f "${MIG}" ]]; then
  echo "ERROR: ${MIG} not found — git pull feat/secretariat-stage7-tac1-freeze first"
  exit 1
fi

echo "==> Applying 104_dpr_whole_job_progress.sql"
"${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 < "${MIG}"

echo "==> Verify columns"
"${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -c "
SELECT column_name FROM information_schema.columns
WHERE table_name = 'boq_items' AND column_name IN ('measurement_mode', 'dpr_execution_status');
"

echo "==> Recreate API"
cd "${DEPLOY}"
"${COMPOSE[@]}" up -d --force-recreate api

echo "DONE. Hard refresh browser (Ctrl+Shift+R)."
