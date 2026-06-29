#!/usr/bin/env bash
# Remove KPG demo complaints (CMP-KPG-*) and portal demo consumer (FHTC-DEMO-001).
# Keeps users, roles, permissions, divisions, and all projects intact.
#
# Run from deploy/hostinger-kvm/ after git pull:
#   bash ../../database/scripts/vps-cleanup-demo-data.sh
#
# Or one-liner from VPS project root:
#   cd deploy/hostinger-kvm && bash ../../database/scripts/vps-cleanup-demo-data.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL="${SCRIPT_DIR}/cleanup-demo-kpg-data.sql"
DEPLOY_DIR="${SCRIPT_DIR}/../../deploy/hostinger-kvm"

if [[ ! -f "${SQL}" ]]; then
  echo "ERROR: SQL file not found: ${SQL}" >&2
  exit 1
fi

cd "${DEPLOY_DIR}"
echo "Removing demo KPG complaints and FHTC-DEMO-001 consumer..."
docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
  psql -U "${DB_USERNAME:-egip}" -d "${DB_DATABASE:-egip}" -v ON_ERROR_STOP=1 \
  < "${SQL}"
echo "Done — restart API: docker compose -f docker-compose.prod.yml --env-file .env restart api"
echo ""
echo "Next: log in as HQ, switch to Karanprayag division, click New Project to create your scheme."
