#!/usr/bin/env bash
# Emergency VPS fix when migration 088 did not apply. Run from deploy/hostinger-kvm/:
#   bash ../../database/scripts/vps-fix-kpg-complaints-one-liner.sh
# Resolves Tharali (PRJ-TPPWSS-2026-27) dynamically — no hardcoded project UUID.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL="${SCRIPT_DIR}/../migrations/088_demo_kpg_complaints_robust.sql"
DEPLOY_DIR="${SCRIPT_DIR}/../../deploy/hostinger-kvm"

if [[ ! -f "${SQL}" ]]; then
  echo "ERROR: SQL file not found: ${SQL}" >&2
  exit 1
fi

cd "${DEPLOY_DIR}"
echo "Applying KPG complaints seed (088_demo_kpg_complaints_robust.sql)..."
docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
  psql -U "${DB_USERNAME:-egip}" -d "${DB_DATABASE:-egip}" -v ON_ERROR_STOP=1 \
  < "${SQL}"
echo "Done — restart API: docker compose -f docker-compose.prod.yml --env-file .env restart api"
