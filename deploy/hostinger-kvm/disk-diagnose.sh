#!/usr/bin/env bash
# Show what is using disk on EGIP Hostinger VPS (read-only).
# Run: bash /opt/egip/deploy/hostinger-kvm/disk-diagnose.sh
set -euo pipefail

ROOT="${EGIP_ROOT:-/opt/egip}"
DEPLOY="${ROOT}/deploy/hostinger-kvm"

echo "========== DISK SUMMARY =========="
df -h /
echo ""

echo "========== TOP LEVEL / =========="
sudo du -xh / --max-depth=1 2>/dev/null | sort -hr | head -20
echo ""

echo "========== DOCKER =========="
docker system df -v 2>/dev/null || echo "Docker not available"
echo ""

echo "========== DOCKER VOLUMES (your data) =========="
for v in $(docker volume ls -q 2>/dev/null | grep -E 'egip|postgres|uploads|redis|geoserver' || true); do
  mp=$(docker volume inspect "$v" --format '{{.Mountpoint}}' 2>/dev/null || echo "?")
  sz=$(sudo du -sh "$mp" 2>/dev/null | cut -f1 || echo "?")
  echo "  $v  →  $sz  ($mp)"
done
echo ""

echo "========== UPLOADS (DPR/PDF files in API) =========="
if [[ -f "${DEPLOY}/.env" ]]; then
  docker compose -f "${DEPLOY}/docker-compose.prod.yml" --env-file "${DEPLOY}/.env" \
    exec -T api du -sh /repo/backend/api/uploads 2>/dev/null || echo "  (api container not running)"
  docker compose -f "${DEPLOY}/docker-compose.prod.yml" --env-file "${DEPLOY}/.env" \
    exec -T api sh -c 'find /repo/backend/api/uploads -type f 2>/dev/null | wc -l' 2>/dev/null \
    | xargs -I{} echo "  file count: {}" || true
else
  echo "  .env not found at ${DEPLOY}"
fi
echo ""

echo "========== DATABASE SIZE =========="
if [[ -f "${DEPLOY}/.env" ]]; then
  docker compose -f "${DEPLOY}/docker-compose.prod.yml" --env-file "${DEPLOY}/.env" \
    exec -T postgres psql -U egip -d egip -t -c \
    "SELECT 'DB total: ' || pg_size_pretty(pg_database_size('egip'));" 2>/dev/null || true
  docker compose -f "${DEPLOY}/docker-compose.prod.yml" --env-file "${DEPLOY}/.env" \
    exec -T postgres psql -U egip -d egip -c \
    "SELECT relname AS table, pg_size_pretty(pg_total_relation_size(relid)) AS size
     FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 12;" 2>/dev/null || true
fi
echo ""

echo "========== GIT REPO ${ROOT} =========="
sudo du -sh "${ROOT}" 2>/dev/null || true
for p in node_modules dist backend/api/node_modules backend/api/dist frontend/web/node_modules frontend/web/dist; do
  if [[ -d "${ROOT}/${p}" ]]; then
    sudo du -sh "${ROOT}/${p}" 2>/dev/null
  fi
done
echo ""

echo "========== LARGE CONTAINER LOGS =========="
sudo find /var/lib/docker/containers -name '*-json.log' -exec du -sh {} \; 2>/dev/null | sort -hr | head -8 || true
echo ""

echo "========== GEOSERVER (if running) =========="
docker ps --format '{{.Names}}' 2>/dev/null | grep -i geoserver && \
  docker compose -f "${DEPLOY}/docker-compose.prod.yml" --env-file "${DEPLOY}/.env" ps geoserver 2>/dev/null || \
  echo "  GeoServer not running (good for disk on 32GB plan)"
echo ""
echo "Run safe cleanup: bash ${DEPLOY}/disk-cleanup-safe.sh --trim-logs --deep"
