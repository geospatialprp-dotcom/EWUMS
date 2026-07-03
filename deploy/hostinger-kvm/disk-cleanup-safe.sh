#!/usr/bin/env bash
# Safe disk cleanup for Hostinger EGIP VPS — does NOT remove:
#   - postgres_data, redis_data, api_uploads, geoserver_data volumes
#   - running containers or application data
#
# Run on VPS:
#   bash /opt/egip/deploy/hostinger-kvm/disk-diagnose.sh          # see what uses space
#   bash /opt/egip/deploy/hostinger-kvm/disk-cleanup-safe.sh      # basic cleanup
#   bash /opt/egip/deploy/hostinger-kvm/disk-cleanup-safe.sh --trim-logs --deep
set -euo pipefail

ROOT="${EGIP_ROOT:-/opt/egip}"
TRIM_LOGS=0
DEEP=0
for arg in "$@"; do
  case "$arg" in
    --trim-logs) TRIM_LOGS=1 ;;
    --deep) DEEP=1 ;;
  esac
done

echo "==> Disk BEFORE"
df -h / | tail -1
docker system df 2>/dev/null || true
echo ""

echo "==> 1. Remove unused Docker images (keeps images used by running containers)"
docker image prune -af

echo "==> 2. Clear Docker build cache (old npm/node build layers)"
docker builder prune -af 2>/dev/null || true

echo "==> 3. Remove stopped containers & unused networks (not volumes)"
docker container prune -f
docker network prune -f

if [[ "${TRIM_LOGS}" -eq 1 ]]; then
  echo "==> 4. Trim ALL container log files (services keep running)"
  if compgen -G "/var/lib/docker/containers/*/*-json.log" >/dev/null 2>&1; then
    find /var/lib/docker/containers -name '*-json.log' -exec truncate -s 0 {} \;
    echo "    Truncated docker json logs"
  fi
fi

if [[ "${DEEP}" -eq 1 ]]; then
  echo "==> 5. Remove host-side build junk (NOT used when app runs in Docker)"
  for p in \
    "${ROOT}/backend/api/node_modules" \
    "${ROOT}/backend/api/dist" \
    "${ROOT}/backend/api/dist-test" \
    "${ROOT}/frontend/web/node_modules" \
    "${ROOT}/frontend/web/dist" \
    "${ROOT}/backend/api/uploads"
  do
    # Never delete host uploads if it is a bind mount — prod uses Docker volume only
    if [[ "${p}" == *"/uploads" ]]; then
      continue
    fi
    if [[ -d "${p}" ]]; then
      sz=$(du -sh "${p}" 2>/dev/null | cut -f1)
      rm -rf "${p}"
      echo "    removed ${p} (was ${sz})"
    fi
  done
  # Accidental duplicate git worktrees / old deploy folders
  for p in "${ROOT}/../egip-old" "${ROOT}/../egip-backup"; do
    if [[ -d "${p}" ]]; then
      echo "    WARN: found ${p} — remove manually if not needed: sudo rm -rf ${p}"
    fi
  done
fi

if [[ "$(id -u)" -eq 0 ]]; then
  echo "==> APT cache + journal (root)"
  apt-get clean -y 2>/dev/null || true
  journalctl --vacuum-time=3d 2>/dev/null || true
fi

echo ""
echo "==> EGIP volumes (unchanged — DB + uploads safe)"
docker volume ls 2>/dev/null | grep -E 'egip-prod|postgres|uploads|redis' || true
for v in $(docker volume ls -q 2>/dev/null | grep egip-prod || true); do
  mp=$(docker volume inspect "$v" --format '{{.Mountpoint}}' 2>/dev/null || echo "")
  [[ -n "$mp" ]] && du -sh "$mp" 2>/dev/null || true
done

echo ""
echo "==> Disk AFTER"
df -h / | tail -1
docker system df 2>/dev/null || true
echo ""
echo "DONE — app data volumes not deleted."
echo ""
echo "If disk is STILL ~33GB, the space is mostly:"
echo "  • PostgreSQL database volume"
echo "  • Uploaded PDF/DPR files (api_uploads)"
echo "  • Docker images currently IN USE (api, web, postgres, redis)"
echo "Those cannot shrink much without deleting data or resizing the VPS disk."
echo "Run: bash ${ROOT}/deploy/hostinger-kvm/disk-diagnose.sh"
