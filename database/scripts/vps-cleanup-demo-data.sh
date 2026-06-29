#!/usr/bin/env bash
# Remove ALL demo complaints (CMP-KPG-*, CMP-2026-* portal demo) and demo consumers.
# Keeps users (ee.kpg, je.kpg), roles, permissions, divisions, and all projects intact.
#
# Run from deploy/hostinger-kvm/ after git pull:
#   bash ../../database/scripts/vps-cleanup-demo-data.sh
#
# One-liner (from repo root on VPS):
#   cd deploy/hostinger-kvm && docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres psql -U "${DB_USERNAME:-egip}" -d "${DB_DATABASE:-egip}" -v ON_ERROR_STOP=1 < ../../database/scripts/cleanup-demo-kpg-data.sql && docker compose -f docker-compose.prod.yml --env-file .env restart api

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL="${SCRIPT_DIR}/cleanup-demo-kpg-data.sql"
DEPLOY_DIR="${SCRIPT_DIR}/../../deploy/hostinger-kvm"

if [[ ! -f "${SQL}" ]]; then
  echo "ERROR: SQL file not found: ${SQL}" >&2
  exit 1
fi

cd "${DEPLOY_DIR}"
echo "Removing ALL demo complaints (CMP-KPG-*, CMP-2026-* portal) and demo consumers..."
docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
  psql -U "${DB_USERNAME:-egip}" -d "${DB_DATABASE:-egip}" -v ON_ERROR_STOP=1 \
  < "${SQL}"
echo "Done — restart API: docker compose -f docker-compose.prod.yml --env-file .env restart api"
echo ""
echo "Next: log in as HQ, switch to Karanprayag division, click New Project to create your scheme."
