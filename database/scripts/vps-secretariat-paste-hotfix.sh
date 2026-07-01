#!/usr/bin/env bash
# Paste this ENTIRE file on VPS when git pull has no new commits yet.
# Usage on VPS:
#   nano /tmp/vps-secretariat-paste-hotfix.sh   # paste, save
#   bash /tmp/vps-secretariat-paste-hotfix.sh
set -euo pipefail

ROOT="/opt/egip"
DEPLOY="${ROOT}/deploy/hostinger-kvm"
COMPOSE=(docker compose -f "${DEPLOY}/docker-compose.prod.yml" --env-file "${DEPLOY}/.env")

cd "${ROOT}"

echo "==> 1/4 SQL — secretariat user + state:view_all"
"${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 <<'EOSQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO roles (id, tenant_id, code, name, is_system)
VALUES ('b0000000-0000-0000-0000-000000000030', 'a0000000-0000-0000-0000-000000000001', 'secretariat', 'Secretariat / Sachiwalaya Officer', TRUE)
ON CONFLICT (id) DO UPDATE SET code = 'secretariat', name = 'Secretariat / Sachiwalaya Officer';
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000030', p.id, 'organization'
FROM permissions p
WHERE (p.resource = 'dpr_proposal' AND p.action IN ('read', 'approve'))
   OR (p.resource = 'dpr_pdf_review' AND p.action IN ('read', 'annotate', 'comment'))
   OR (p.resource = 'state' AND p.action = 'view_all')
ON CONFLICT DO NOTHING;
INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, department, status)
VALUES ('c0000000-0000-0000-0000-000000000030', 'a0000000-0000-0000-0000-000000000001', 'secretariat@egip.local',
  crypt('Sec@123', gen_salt('bf')), 'Sachiwalaya', 'Secretariat Officer', 'Secretariat', 'active')
ON CONFLICT (tenant_id, email) DO UPDATE SET password_hash = crypt('Sec@123', gen_salt('bf')), status = 'active';
DELETE FROM user_roles ur USING users u, roles r
WHERE ur.user_id = u.id AND ur.role_id = r.id AND u.email = 'secretariat@egip.local' AND r.code <> 'secretariat';
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, 'b0000000-0000-0000-0000-000000000030' FROM users u WHERE u.email = 'secretariat@egip.local'
ON CONFLICT DO NOTHING;
EOSQL

echo "==> 2/4 API — secretariat statewide division access"
DIV_FILE="${ROOT}/backend/api/src/modules/divisions/division-access.service.ts"
if ! grep -q "'secretariat'" "${DIV_FILE}"; then
  sed -i "s/'ce', 'md', 'cgm', 'state_finance'/'ce', 'md', 'cgm', 'se', 'secretariat', 'state_finance'/" "${DIV_FILE}"
fi
grep -n "STATE_WIDE_ROLES" -A2 "${DIV_FILE}"

echo "==> 3/6 API — Stage 7 Round 2 = Secretariat only (not Super Admin)"
python3 <<'PY'
from pathlib import Path
p = Path("/opt/egip/backend/api/src/modules/dpr-planning/dpr-planning.service.ts")
text = p.read_text()
old = "private canReviewTacRound2(roles: string[]) {\n    return isStateReviewer(roles);\n  }"
new = "private canReviewTacRound2(roles: string[]) {\n    return roles.includes('secretariat');\n  }"
if old in text:
    text = text.replace(old, new)
    print("Patched canReviewTacRound2 -> secretariat")
elif "roles.includes('secretariat')" in text:
    print("canReviewTacRound2 already secretariat")
else:
    raise SystemExit("Could not patch canReviewTacRound2 — check dpr-planning.service.ts")
text = text.replace(
    "Only Super Admin can conduct Round 2 TAC / Govt examination",
    "Only Secretariat officials can conduct Round 2 TAC / Govt examination",
)
p.write_text(text)
PY

echo "==> 4/6 Web — Stage 7 buttons for Secretariat role"
python3 <<'PY'
from pathlib import Path
p = Path("/opt/egip/frontend/web/src/constants/dprPlanningWorkflow.ts")
text = p.read_text()
old = "export function canPerformTacRound2Review(roles: string[]): boolean {\n  return isStateReviewer(roles);\n}"
new = "export function canPerformTacRound2Review(roles: string[]): boolean {\n  return roles.includes('secretariat');\n}"
if old in text:
    text = text.replace(old, new)
    print("Patched canPerformTacRound2Review -> secretariat")
elif "roles.includes('secretariat')" in text and "canPerformTacRound2Review" in text:
    print("canPerformTacRound2Review already secretariat")
else:
    # newer tree uses DPR_SECRETARIAT_REVIEWER_ROLES
    print("Skipped workflow constants (already updated or different layout)")
p.write_text(text)
PY

echo "==> 5/6 Web — hide Map / Platform / Workflow for Secretariat (permission gates)"
LAYOUT="${ROOT}/frontend/web/src/components/layout/AppLayout.tsx"
python3 <<'PY'
from pathlib import Path
p = Path("/opt/egip/frontend/web/src/components/layout/AppLayout.tsx")
text = p.read_text()
replacements = [
    ("{ path: '/platform', labelKey: 'nav.platformModules', icon: <AppsOutlinedIcon /> },",
     "{ path: '/platform', labelKey: 'nav.platformModules', icon: <AppsOutlinedIcon />, permission: 'project:read' },"),
    ("{ path: '/map', labelKey: 'nav.mapExplorer', icon: <MapIcon /> },",
     "{ path: '/map', labelKey: 'nav.mapExplorer', icon: <MapIcon />, permission: 'layer:read' },"),
    ("{ path: '/workflows', labelKey: 'nav.workflowCenter', icon: <InboxIcon /> },",
     "{ path: '/workflows', labelKey: 'nav.workflowCenter', icon: <InboxIcon />, permission: 'project:read' },"),
]
for old, new in replacements:
    if old in text and new not in text:
        text = text.replace(old, new)
p.write_text(text)
print("AppLayout patched")
PY

echo "==> 6/6 Freeze TAC1 official PDF for Tharali (if dpr_complete_pdf exists)"
"${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 <<'EOSQL'
WITH p AS (
  SELECT id FROM dpr_proposals WHERE proposal_no = 'DPRP-2026-27-KPG-0001'
),
doc AS (
  SELECT d.id, d.version_no, d.file_name
  FROM dpr_proposal_documents d
  JOIN p ON d.proposal_id = p.id
  WHERE d.document_type = 'dpr_complete_pdf'
  ORDER BY d.version_no DESC
  LIMIT 1
)
UPDATE dpr_proposals pr
SET hq_verification = jsonb_set(
  COALESCE(pr.hq_verification, '{}'::jsonb),
  '{tacRound1,officialPackage}',
  jsonb_build_object(
    'documentId', doc.id,
    'versionNo', doc.version_no,
    'fileName', doc.file_name,
    'frozenAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'source', 'vps_hotfix',
    'label', 'TAC Round 1 — Reviewed DPR (official)'
  ),
  true
)
FROM p, doc
WHERE pr.id = p.id
RETURNING pr.proposal_no, pr.hq_verification->'tacRound1'->'officialPackage' AS tac1_official;
EOSQL

echo "==> Rebuild api + web"
cd "${DEPLOY}"
"${COMPOSE[@]}" build api web
"${COMPOSE[@]}" up -d api web

echo ""
echo "==> DPR proposals in DB:"
"${COMPOSE[@]}" exec -T postgres psql -U egip -d egip -c \
  "SELECT proposal_no, status, current_stage FROM dpr_proposals ORDER BY created_at DESC LIMIT 5;"

echo ""
echo "DONE. Log OUT, log IN as secretariat@egip.local / Sec@123, then Ctrl+Shift+R."
echo "Open Stage 7 — Round 2 Review (NOT generic Workflow). Grant concurrence after checklist."
