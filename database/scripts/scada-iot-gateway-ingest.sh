#!/usr/bin/env bash
# EWUMS SCADA/IoT gateway — one ingest cycle for VPS cron.
#
# Cron example (every 5 minutes):
#   */5 * * * * /opt/egip/database/scripts/scada-iot-gateway-ingest.sh >> /var/log/egip-scada-gateway.log 2>&1
#
# Required env (set in optional env file or export before run):
#   EWUMS_EMAIL, EWUMS_PASSWORD
# Optional:
#   EWUMS_BASE_URL, PROJECT_CODE, INTERVAL_SECONDS (ignored in --once mode)
#   SCADA_GATEWAY_ENV — path to env file (default: /opt/egip/deploy/hostinger-kvm/.scada-gateway.env)
set -euo pipefail

ROOT="${EGIP_ROOT:-/opt/egip}"
SCRIPT="${ROOT}/database/scripts/scada-iot-gateway-ingest.py"
ENV_FILE="${SCADA_GATEWAY_ENV:-${ROOT}/deploy/hostinger-kvm/.scada-gateway.env}"

if [[ ! -f "${SCRIPT}" ]]; then
  echo "ERROR: ${SCRIPT} not found — git pull on VPS first"
  exit 1
fi

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

if [[ -z "${EWUMS_EMAIL:-}" || -z "${EWUMS_PASSWORD:-}" ]]; then
  echo "ERROR: EWUMS_EMAIL and EWUMS_PASSWORD must be set (or in ${ENV_FILE})"
  exit 1
fi

exec python3 "${SCRIPT}" --once
