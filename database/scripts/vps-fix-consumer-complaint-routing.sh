#!/usr/bin/env bash
# Apply migration 090 on VPS — fixes Jal Mitra complaints not appearing for EE Karanprayag.
# Usage (on VPS):
#   bash database/scripts/vps-fix-consumer-complaint-routing.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL="${SCRIPT_DIR}/../migrations/090_consumer_complaint_kpg_routing.sql"

if [[ ! -f "$SQL" ]]; then
  echo "Missing $SQL"
  exit 1
fi

echo "Applying consumer complaint KPG routing fix (090)..."
docker compose -f /opt/egip/docker-compose.yml exec -T postgres \
  psql -U egip -d egip -v ON_ERROR_STOP=1 -f - < "$SQL"

echo "Done. Restart API: docker compose -f /opt/egip/deploy/hostinger-kvm/docker-compose.app.yml restart api"
