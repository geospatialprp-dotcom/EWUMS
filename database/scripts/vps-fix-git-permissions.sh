#!/usr/bin/env bash
# Fix /opt/egip git "Unlink of file .git/objects/pack/... failed" (root-owned repo / stale locks).
# Run on VPS as root:
#   bash /opt/egip/database/scripts/vps-fix-git-permissions.sh
set -euo pipefail

ROOT="/opt/egip"
APP_USER="egip"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

if ! id "${APP_USER}" &>/dev/null; then
  echo "User ${APP_USER} not found"
  exit 1
fi

echo "==> Stop stray git processes (if any)"
pkill -u "${APP_USER}" -x git 2>/dev/null || true
sleep 1

echo "==> Remove stale git lock files"
find "${ROOT}/.git" -maxdepth 3 \( -name '*.lock' -o -name 'shallow.lock' \) -delete 2>/dev/null || true

echo "==> Fix ownership (root-owned .git blocks egip git fetch/reset)"
chown -R "${APP_USER}:${APP_USER}" "${ROOT}"

echo "==> Verify egip can write pack index"
PACK_IDX="$(find "${ROOT}/.git/objects/pack" -name 'pack-*.idx' 2>/dev/null | head -1 || true)"
if [[ -n "${PACK_IDX}" ]]; then
  sudo -u "${APP_USER}" test -w "${PACK_IDX}" || {
    echo "ERROR: ${PACK_IDX} still not writable by ${APP_USER}"
    ls -la "${PACK_IDX}"
    exit 1
  }
fi

echo "OK: ${ROOT} is owned by ${APP_USER}:${APP_USER}"
echo ""
echo "Next (as root):"
echo "  bash ${ROOT}/database/scripts/vps-deploy-feat-secretariat.sh"
echo ""
echo "Or manual git pull:"
echo "  cd ${ROOT}"
echo "  sudo -u ${APP_USER} GIT_TERMINAL_PROMPT=0 git fetch origin feat/secretariat-stage7-tac1-freeze"
echo "  sudo -u ${APP_USER} git reset --hard origin/feat/secretariat-stage7-tac1-freeze"
