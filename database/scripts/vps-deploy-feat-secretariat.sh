#!/usr/bin/env bash
# ONE-SHOT VPS deploy for Secretariat Stage 7 (use when main is still old).
# Run on VPS as root:
#   bash /opt/egip/database/scripts/vps-deploy-feat-secretariat.sh
set -euo pipefail

ROOT="/opt/egip"
BRANCH="feat/secretariat-stage7-tac1-freeze"
DEPLOY="${ROOT}/deploy/hostinger-kvm"
APP_USER="egip"
COMPOSE=(docker compose -f "${DEPLOY}/docker-compose.prod.yml" --env-file "${DEPLOY}/.env")

if [[ "$(id -u)" -eq 0 ]] && id "${APP_USER}" &>/dev/null; then
  echo "==> 0. Fix repo ownership (root-owned .git blocks egip git fetch)"
  chown -R "${APP_USER}:${APP_USER}" "${ROOT}"
fi

echo "==> 1. Pull branch ${BRANCH} (NOT main — fixes are only on this branch)"
cd "${ROOT}"
sudo -u "${APP_USER}" git fetch origin "${BRANCH}"
sudo -u "${APP_USER}" git checkout "${BRANCH}" 2>/dev/null || true
sudo -u "${APP_USER}" git reset --hard "origin/${BRANCH}"
echo "    Commit: $(sudo -u "${APP_USER}" git -C "${ROOT}" rev-parse --short HEAD) $(sudo -u "${APP_USER}" git -C "${ROOT}" log -1 --format='%s')"

echo "==> 2. DB migrations (096–101)"
for mig in 096_project_deletion_ee_approval.sql 097_secretariat_dpr_role.sql 098_secretariat_stage8_dpr_update.sql \
  099_ee_project_create_after_tender.sql 100_super_admin_no_dpr_proposal_create.sql 101_audit_log_gps_coordinates.sql; do
  if [[ -f "${ROOT}/database/migrations/${mig}" ]]; then
    "${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 \
      < "${ROOT}/database/migrations/${mig}" || echo "WARN: ${mig} skipped"
  fi
done

echo "==> 3. Freeze TAC1 official PDF for Tharali demo"
"${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 \
  < "${ROOT}/database/scripts/vps-freeze-tac1-official.sql" || echo "WARN: freeze skipped (no dpr_complete_pdf?)"

echo "==> 4. Rebuild API + Web (web --no-cache so UI fixes always apply)"
cd "${DEPLOY}"
"${COMPOSE[@]}" build api
"${COMPOSE[@]}" build --no-cache web
"${COMPOSE[@]}" up -d api web

echo "==> 4b. Prune old Docker layers (keeps running app)"
docker image prune -af
docker builder prune -af 2>/dev/null || true

echo ""
echo "==> 5. Verify"
"${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -c "
SELECT proposal_no, status, current_stage,
       hq_verification->'tacRound1'->'officialPackage'->>'fileName' AS tac1_pdf
FROM dpr_proposals WHERE proposal_no = 'DPRP-2026-27-KPG-0001';"

echo "==> 6. Optional — LA readiness for Stage 8 sanction (Tharali demo)"
"${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 \
  < "${ROOT}/database/scripts/vps-setup-la-tharali-demo.sql" || echo "WARN: LA setup skipped"

echo ""
echo "DONE."
echo "  IMPORTANT: Push latest commits to origin/${BRANCH} before running this script."
echo "  1) Log OUT in browser, then Ctrl+Shift+R (hard refresh)"
echo "  2) Secretariat Stage 7: secretariat@egip.local / Sec@123"
echo "     - Opens TAC1-reviewed DPR (annotated source PDF, not latest EE upload)"
echo "  3) Secretariat Stage 8: same login at govt_technical_concurrence"
echo "     - Stage 8 — Record Sanction (AA, ES, budget, funding release)"
echo "  4) Super Admin liaison only: admin@egip.local / Admin@123"
