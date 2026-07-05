#!/usr/bin/env bash
# Fix MB save 500 on VPS: allow duplicate MB numbers + rebuild API.
set -euo pipefail
ROOT="/opt/egip"
DEPLOY="${ROOT}/deploy/hostinger-kvm"
COMPOSE=(docker compose -f "${DEPLOY}/docker-compose.prod.yml" --env-file "${DEPLOY}/.env")

echo "==> Apply migration 105 (duplicate MB numbers allowed)"
"${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 \
  < "${ROOT}/database/migrations/105_mb_number_not_unique.sql"

echo "==> Rebuild API"
cd "${DEPLOY}"
"${COMPOSE[@]}" build api
"${COMPOSE[@]}" up -d api

echo "DONE — retry MB save in browser (Ctrl+Shift+R first)."
