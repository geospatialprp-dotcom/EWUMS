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
"${COMPOSE[@]}" build --no-cache api web
"${COMPOSE[@]}" up -d api web

echo ""
echo "DONE. Login: geospatialprp@gmail.com / JE@123"
echo "Go: O&M Management -> Asset Handover -> yellow Approve Handover bar"
