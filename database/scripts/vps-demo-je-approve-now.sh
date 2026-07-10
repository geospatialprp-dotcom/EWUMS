#!/usr/bin/env bash
# Emergency demo: JE-approve Tharali handover via DB (no new UI needed).
# Run ON THE VPS (SSH), NOT on Windows:
#   bash /opt/egip/database/scripts/vps-demo-je-approve-now.sh
set -euo pipefail

ROOT="/opt/egip"
DEPLOY="${ROOT}/deploy/hostinger-kvm"
COMPOSE=(docker compose -f "${DEPLOY}/docker-compose.prod.yml" --env-file "${DEPLOY}/.env")
SQL="${ROOT}/database/scripts/vps-demo-je-approve-now.sql"

if [[ ! -f "${SQL}" ]]; then
  echo "ERROR: ${SQL} not found. Run: cd ${ROOT} && git pull origin feat/secretariat-stage7-tac1-freeze"
  exit 1
fi

echo "==> Repair JE user + workflow inbox"
"${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 \
  < "${ROOT}/database/scripts/vps-fix-kpg-je-handover.sql" || true

echo "==> Force JE approval (Tharali handover -> ae_review)"
"${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 < "${SQL}"

echo ""
echo "DONE. Handover should now be ae_review."
echo "Login AE: ae.kpg@egip.local (or your KPG AE account) -> O&M -> Asset Handover"
