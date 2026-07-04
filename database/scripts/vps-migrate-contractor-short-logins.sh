#!/usr/bin/env bash
# Migrate contractor.negi.and.sons@egip.local → c.negi@egip.local (and similar).
# Run on VPS:
#   bash /opt/egip/database/scripts/vps-migrate-contractor-short-logins.sh
set -euo pipefail

ROOT="/opt/egip"
DEPLOY="${ROOT}/deploy/hostinger-kvm"
COMPOSE=(docker compose -f "${DEPLOY}/docker-compose.prod.yml" --env-file "${DEPLOY}/.env")
SQL="${ROOT}/database/scripts/vps-migrate-contractor-short-logins.sql"

if [[ ! -f "${SQL}" ]]; then
  echo "ERROR: ${SQL} not found — git pull feat/secretariat-stage7-tac1-freeze first"
  exit 1
fi

echo "==> Migrate legacy contractor.* logins to c.*"
"${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 < "${SQL}"

echo ""
echo "DONE. Contractors must log in with the new short ID (password unchanged: Contractor@123)."
