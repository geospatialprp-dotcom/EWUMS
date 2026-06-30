#!/usr/bin/env bash
# Apply pending SQL migrations without full rebuild. Run from deploy/hostinger-kvm/
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.production.example to .env and edit it."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "==> Ensuring PostgreSQL is up"
${COMPOSE} up -d postgres

postgres_ready=0
for i in $(seq 1 30); do
  if ${COMPOSE} exec -T postgres pg_isready -U "${DB_USERNAME:-egip}" -d "${DB_DATABASE:-egip}" >/dev/null 2>&1; then
    postgres_ready=1
    break
  fi
  sleep 2
done
if [[ "${postgres_ready}" -ne 1 ]]; then
  echo "PostgreSQL did not become ready."
  exit 1
fi

echo "==> Applying SQL migrations (from ../../database/migrations)"
MIGRATE_CMD='printf "DB_HOST=postgres\nDB_PORT=5432\nDB_USERNAME=%s\nDB_PASSWORD=%s\nDB_DATABASE=%s\n" "$DB_USERNAME" "$DB_PASSWORD" "$DB_DATABASE" > /repo/backend/api/.env && node scripts/apply-sql-migrations.js'
${COMPOSE} --profile tools run --rm migrate sh -c "${MIGRATE_CMD}"

echo ""
echo "==> Verify DPR PDF review tables"
${COMPOSE} exec -T postgres psql -U "${DB_USERNAME:-egip}" -d "${DB_DATABASE:-egip}" -c \
  "SELECT filename FROM schema_migrations WHERE filename LIKE '%dpr_pdf%' ORDER BY filename;"

echo ""
echo "Migrations complete. Restart API if it was already running:"
echo "  ${COMPOSE} up -d api web"
