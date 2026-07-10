#!/usr/bin/env bash
# Deploy JE/AE/EE handover UX fix — run ON VPS via SSH only (not Windows).
set -euo pipefail
ROOT="/opt/egip"
BRANCH="feat/secretariat-stage7-tac1-freeze"
DEPLOY="${ROOT}/deploy/hostinger-kvm"
COMPOSE=(docker compose -f "${DEPLOY}/docker-compose.prod.yml" --env-file "${DEPLOY}/.env")

cd "${ROOT}"
git fetch origin "${BRANCH}"
git reset --hard "origin/${BRANCH}"
echo "Commit: $(git log -1 --oneline)"

echo "==> Ensure O&M asset columns (installation_date, design_life_years, warranty_details)"
"${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 \
  < "${ROOT}/database/migrations/029_om_asset_registry.sql"

echo "==> Ensure om:create + om:update permissions for field roles"
"${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 \
  < "${ROOT}/database/scripts/fix-om-create-permissions-vps.sql"

echo "==> Fix KPG JE account (je role only, Karanprayag division)"
"${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 \
  < "${ROOT}/database/scripts/vps-fix-kpg-je-handover.sql"

cd "${DEPLOY}"
echo "==> Building web + api (5-10 min)..."
if ! "${COMPOSE[@]}" build --no-cache web api; then
  echo "ERROR: docker build failed"
  exit 1
fi
"${COMPOSE[@]}" up -d web api

echo "==> Verify role-scoped handover UI"
for i in 1 2 3 4 5 6; do
  curl -fsS http://127.0.0.1:8081/ >/dev/null 2>&1 && break
  echo "    waiting for web (${i}/6)..."
  sleep 5
done
JS_PATH="$(curl -fsS http://127.0.0.1:8081/ 2>/dev/null | grep -oE '/assets/index-[^"]+\.js' | head -1 || true)"
if [[ -n "${JS_PATH}" ]]; then
  BUNDLE="$(curl -fsS "http://127.0.0.1:8081${JS_PATH}" 2>/dev/null || true)"
  if echo "${BUNDLE}" | grep -q 'JE / Department'; then
    echo "FAIL: still serving OLD handover UI (${JS_PATH})"
    exit 1
  fi
  if echo "${BUNDLE}" | grep -q 'Approve Handover'; then
    echo "OK: new handover UI deployed (${JS_PATH})"
  fi
fi

echo ""
echo "DONE. Logout + Ctrl+Shift+R in browser."
echo "  JE (geospatialprp@gmail.com): empty panel if handover is past JE step — no division dropdown"
echo "  AE (ae.kpg@egip.local / AE@123): Tharali handover is at AE Review — approve here"
echo "  EE (ee.kpg@egip.local / EE@123): after AE approves"
