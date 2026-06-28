#!/usr/bin/env bash
# First-time Hostinger KVM VPS setup for EGIP (Ubuntu 22.04/24.04).
# Run as root or with sudo on a fresh VPS:
#   curl -fsSL .../setup.sh | bash
# Or after cloning:
#   sudo bash deploy/hostinger-kvm/setup.sh

set -euo pipefail

APP_USER="${APP_USER:-egip}"
APP_DIR="${APP_DIR:-/opt/egip}"
REPO_URL="${REPO_URL:-https://github.com/geospatialprp-dotcom/EWUMS.git}"
BRANCH="${BRANCH:-main}"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

echo "==> Updating system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl git gnupg lsb-release ufw nginx certbot python3-certbot-nginx

echo "==> Installing Docker (official script)"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable docker
systemctl start docker

echo "==> Installing Docker Compose plugin"
apt-get install -y docker-compose-plugin

echo "==> Creating application user: ${APP_USER}"
if ! id "${APP_USER}" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "${APP_USER}"
fi
usermod -aG docker "${APP_USER}"

echo "==> Cloning repository to ${APP_DIR}"
if [[ ! -d "${APP_DIR}/.git" ]]; then
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
  chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
else
  echo "    Repository already exists at ${APP_DIR}, skipping clone"
fi

DEPLOY_DIR="${APP_DIR}/deploy/hostinger-kvm"
if [[ ! -f "${DEPLOY_DIR}/.env" ]]; then
  cp "${DEPLOY_DIR}/.env.production.example" "${DEPLOY_DIR}/.env"
  echo "    Created ${DEPLOY_DIR}/.env — edit before starting the stack"
fi

echo "==> Configuring UFW firewall"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> Installing systemd unit for EGIP"
cp "${DEPLOY_DIR}/systemd/egip.service" /etc/systemd/system/egip.service
systemctl daemon-reload
systemctl enable egip.service

chmod +x "${DEPLOY_DIR}/setup.sh" "${DEPLOY_DIR}/deploy.sh"

echo ""
echo "Setup complete."
echo ""
echo "Next steps (as ${APP_USER}):"
echo "  1. sudo -u ${APP_USER} nano ${DEPLOY_DIR}/.env"
echo "  2. Point DNS A record for your domain to this server's IP"
echo "  3. sudo cp ${DEPLOY_DIR}/nginx/egip.conf /etc/nginx/sites-available/egip"
echo "     sudo sed -i 's/YOUR_DOMAIN/your-actual-domain.com/g' /etc/nginx/sites-available/egip"
echo "     sudo ln -sf /etc/nginx/sites-available/egip /etc/nginx/sites-enabled/egip"
echo "     sudo nginx -t && sudo systemctl reload nginx"
echo "  4. sudo -u ${APP_USER} bash ${DEPLOY_DIR}/deploy.sh"
echo "  5. sudo certbot --nginx -d your-actual-domain.com -d www.your-actual-domain.com"
echo ""
echo "See ${DEPLOY_DIR}/README.md for full documentation."
