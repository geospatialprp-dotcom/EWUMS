#!/usr/bin/env bash
# Secretariat demo: SQL + rebuild API/web on VPS
# Run from repo root on VPS: bash database/scripts/vps-deploy-secretariat-demo.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEPLOY="${ROOT}/deploy/hostinger-kvm"
COMPOSE=(docker compose -f "${DEPLOY}/docker-compose.prod.yml" --env-file "${DEPLOY}/.env")

echo "==> Secretariat SQL (user, role, state:view_all)"
"${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 \
  < "${ROOT}/database/scripts/vps-fix-secretariat-login.sql"

echo "==> Rebuild and restart API + web"
"${COMPOSE[@]}" build api web
"${COMPOSE[@]}" up -d api web

echo ""
echo "Done. Log out and log in as secretariat@egip.local / Sec@123"
echo "Expected: sidebar shows DPR Approval Pipeline only; Tharali proposal visible if forwarded to Secretariat."
