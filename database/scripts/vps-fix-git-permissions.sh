#!/usr/bin/env bash
# Fix /opt/egip owned by root so egip user can git pull. Run as root:
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

chown -R "${APP_USER}:${APP_USER}" "${ROOT}"
echo "OK: ${ROOT} is now owned by ${APP_USER}:${APP_USER}"
echo "Next:"
echo "  cd ${ROOT}"
echo "  sudo -u ${APP_USER} git fetch origin feat/secretariat-stage7-tac1-freeze"
echo "  sudo -u ${APP_USER} git reset --hard origin/feat/secretariat-stage7-tac1-freeze"
echo "  bash database/scripts/vps-deploy-feat-secretariat.sh"
