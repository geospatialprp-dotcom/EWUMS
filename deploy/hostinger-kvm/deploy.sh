#!/usr/bin/env bash
# Build, migrate, and restart EGIP production stack.
# Run from anywhere on the VPS after editing deploy/hostinger-kvm/.env

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.production.example to .env and edit it."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "==> Pulling latest code"
git -C ../.. pull --ff-only origin "${BRANCH:-main}" || true

echo "==> Building images"
${COMPOSE} build

echo "==> Starting infrastructure"
${COMPOSE} up -d postgres redis

echo "==> Waiting for PostgreSQL"
for i in $(seq 1 30); do
  if ${COMPOSE} exec -T postgres pg_isready -U "${DB_USERNAME:-egip}" -d "${DB_DATABASE:-egip}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Running database migrations"
${COMPOSE} --profile tools run --rm migrate

echo "==> Starting application"
${COMPOSE} up -d api web

echo "==> Service status"
${COMPOSE} ps

echo ""
echo "EGIP is running locally at http://127.0.0.1:8081"
echo "Configure host nginx + Certbot to expose https://YOUR_DOMAIN"
