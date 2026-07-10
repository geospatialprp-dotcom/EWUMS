#!/usr/bin/env bash
# Deploy: JE map division scope + SCADA ingest + breakdown fixes.
# Run ON VPS via SSH only (not Windows PowerShell).
set -euo pipefail

ROOT="/opt/egip"
BRANCH="feat/secretariat-stage7-tac1-freeze"
DEPLOY="${ROOT}/deploy/hostinger-kvm"
COMPOSE=(docker compose -f "${DEPLOY}/docker-compose.prod.yml" --env-file "${DEPLOY}/.env")

cd "${ROOT}"
git fetch origin "${BRANCH}"
git reset --hard "origin/${BRANCH}"
echo "Commit: $(git log -1 --oneline)"

run_sql() {
  local label="$1"
  local file="$2"
  echo "==> ${label}"
  "${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 < "${file}"
}

run_sql "Migration 113 — SCADA operator om:create" \
  "${ROOT}/database/migrations/113_scada_operator_om_create.sql"

run_sql "Migration 114 — JE map division scope (no full state)" \
  "${ROOT}/database/migrations/114_je_map_division_scope.sql"

run_sql "Re-affirm KPG JE account (je role + Karanprayag)" \
  "${ROOT}/database/scripts/vps-fix-kpg-je-handover.sql"

run_sql "Consumer portal OTP table + demo login repair" \
  "${ROOT}/database/scripts/vps-fix-consumer-portal-otp.sql"

cd "${DEPLOY}"
echo "==> Building web + api (5-10 min)..."
if ! "${COMPOSE[@]}" build --no-cache web api; then
  echo "ERROR: docker build failed"
  exit 1
fi
"${COMPOSE[@]}" up -d web api

echo "==> Waiting for web..."
for i in 1 2 3 4 5 6; do
  curl -fsS http://127.0.0.1:8081/ >/dev/null 2>&1 && break
  echo "    waiting (${i}/6)..."
  sleep 5
done

echo ""
echo "DONE."
echo "  1. Logout + login again (fresh JWT for map scope)"
echo "  2. Hard refresh: Ctrl+Shift+R"
echo "  3. Map Explorer (JE): Chamoli District · Karanprayag — NOT full state"
echo "  4. Super Admin: Register Consumer hidden (view-only on Consumer Service)"
echo "  5. JE/AE/EE: Register Consumer remains available for division staff"
echo "  6. SCADA gateway (optional):"
echo "       cp deploy/hostinger-kvm/.scada-gateway.env.example deploy/hostinger-kvm/.scada-gateway.env"
echo "       edit EWUMS_EMAIL / EWUMS_PASSWORD, then:"
echo "       python3 database/scripts/scada-iot-gateway-ingest.py --once"
