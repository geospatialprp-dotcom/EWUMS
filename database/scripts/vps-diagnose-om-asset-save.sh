#!/usr/bin/env bash
# Diagnose O&M asset additional-details save — run ON VPS via SSH.
set -euo pipefail
ROOT="/opt/egip"
DEPLOY="${ROOT}/deploy/hostinger-kvm"
COMPOSE=(docker compose -f "${DEPLOY}/docker-compose.prod.yml" --env-file "${DEPLOY}/.env")
PSQL=("${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1)

echo "==> Git commit on VPS"
cd "${ROOT}" && git log -1 --oneline

echo ""
echo "==> O&M asset columns on assets table"
"${PSQL[@]}" -c "\d assets" | grep -E "installation_date|design_life_years|warranty_details" || echo "MISSING COLUMNS — run migration 029"

echo ""
echo "==> O&M asset count"
"${PSQL[@]}" -c "SELECT COUNT(*) AS om_assets FROM assets WHERE deleted_at IS NULL AND (project_id IS NOT NULL OR handover_id IS NOT NULL OR om_category IS NOT NULL);"

echo ""
echo "==> Latest 5 O&M assets (additional details)"
"${PSQL[@]}" -c "SELECT asset_code, installation_date, design_life_years, LEFT(COALESCE(warranty_details,''), 40) AS warranty, updated_at FROM assets WHERE deleted_at IS NULL AND (project_id IS NOT NULL OR om_category IS NOT NULL) ORDER BY updated_at DESC NULLS LAST LIMIT 5;"

echo ""
echo "==> om:update permissions for field roles"
"${PSQL[@]}" -c "SELECT r.code, p.resource || ':' || p.action AS permission FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id WHERE p.resource = 'om' AND p.action IN ('create','update') AND r.code IN ('je','ae','ee','om_operator','super_admin') ORDER BY r.code, p.action;"

echo ""
echo "==> Direct SQL write test (first OM asset) — proves DB columns work"
"${PSQL[@]}" -c "UPDATE assets SET installation_date = '2026-07-07', design_life_years = 15, warranty_details = 'VPS diagnostic test', updated_at = NOW() WHERE id = (SELECT id FROM assets WHERE deleted_at IS NULL AND asset_code LIKE 'OM-%' ORDER BY updated_at DESC NULLS LAST LIMIT 1) RETURNING asset_code, installation_date, design_life_years, warranty_details;"

echo ""
echo "DONE. If SQL test shows values but browser Save does not, rebuild api+web:"
echo "  bash ${ROOT}/database/scripts/vps-deploy-je-handover-ux.sh"
