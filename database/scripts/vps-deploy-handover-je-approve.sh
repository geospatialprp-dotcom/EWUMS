#!/usr/bin/env bash
# One-shot: deploy handover JE approval fix on VPS (run as root via SSH).
set -euo pipefail
ROOT="/opt/egip"
BRANCH="feat/secretariat-stage7-tac1-freeze"
DEPLOY="${ROOT}/deploy/hostinger-kvm"
COMPOSE=(docker compose -f "${DEPLOY}/docker-compose.prod.yml" --env-file "${DEPLOY}/.env")

cd "${ROOT}"
git fetch origin "${BRANCH}"
git reset --hard "origin/${BRANCH}"
echo "Commit: $(git log -1 --oneline)"

for mig in 111_tharali_handover_je_inbox.sql 112_handover_je_inbox_repair.sql; do
  if [[ -f "${ROOT}/database/migrations/${mig}" ]]; then
    "${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 \
      < "${ROOT}/database/migrations/${mig}" || true
  fi
done

if [[ -f "${ROOT}/database/scripts/vps-fix-kpg-je-handover.sql" ]]; then
  "${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 \
    < "${ROOT}/database/scripts/vps-fix-kpg-je-handover.sql" || true
fi

cd "${DEPLOY}"
echo "==> Building API + Web (this takes several minutes)..."
if ! "${COMPOSE[@]}" build --no-cache api web; then
  echo "ERROR: docker build failed — paste this full output when asking for help"
  exit 1
fi
"${COMPOSE[@]}" up -d api web

echo "==> Verify new UI is live"
for i in 1 2 3 4 5 6; do
  if curl -fsS http://127.0.0.1:8081/ >/dev/null 2>&1; then
    break
  fi
  echo "    waiting for web on :8081 (${i}/6)..."
  sleep 5
done
JS_PATH="$(curl -fsS http://127.0.0.1:8081/ 2>/dev/null | grep -oE '/assets/index-[^"]+\.js' | head -1 || true)"
if [[ -z "${JS_PATH}" ]]; then
  echo "WARN: could not read web from localhost:8081 (containers may still be starting)"
  echo "      Check public site: hard refresh browser after 30s"
else
  if curl -fsS "http://127.0.0.1:8081${JS_PATH}" 2>/dev/null | grep -q 'Approve Handover'; then
    echo "OK: new handover approval UI is deployed (${JS_PATH})"
  else
    echo "WARN: bundle ${JS_PATH} missing Approve Handover string — check git commit on VPS"
  fi
fi

echo ""
echo "DONE. Login: geospatialprp@gmail.com / JE@123"
echo "Go: O&M Management -> Asset Handover -> yellow Approve Handover bar"
echo "If UI still missing in browser: logout, Ctrl+Shift+R hard refresh"
