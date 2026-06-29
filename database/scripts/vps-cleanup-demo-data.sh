#!/usr/bin/env bash
# Remove ALL demo data: complaints/consumers (091) + legacy demo projects (092).
# Removes Zone A (PRJ-ZAPR-2025-26), f0000000 seed projects, presentation DNN/HRR demos.
# Keeps: users (ee.kpg, je.kpg), divisions, roles, permissions, Tharali (PRJ-TPPWSS-2026-27).
#
# Run from repo root on VPS after git pull:
#   bash database/scripts/vps-cleanup-demo-data.sh
#
# Or from deploy/hostinger-kvm/:
#   bash ../../database/scripts/vps-cleanup-demo-data.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL="${SCRIPT_DIR}/cleanup-demo-kpg-data.sql"
DEPLOY_DIR="${SCRIPT_DIR}/../../deploy/hostinger-kvm"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env"

if [[ ! -f "${SQL}" ]]; then
  echo "ERROR: SQL file not found: ${SQL}" >&2
  exit 1
fi

cd "${DEPLOY_DIR}"
echo "Removing demo complaints, consumers, and legacy demo projects (Zone A, f0000000 seeds)..."
${COMPOSE} exec -T postgres \
  psql -U "${DB_USERNAME:-egip}" -d "${DB_DATABASE:-egip}" -v ON_ERROR_STOP=1 \
  < "${SQL}"

echo "Restarting API..."
${COMPOSE} restart api

echo ""
echo "Done. Log in as HQ or ee.kpg@egip.local, switch to Karanprayag division,"
echo "and use New Project to create your real scheme (Tharali is unchanged)."
