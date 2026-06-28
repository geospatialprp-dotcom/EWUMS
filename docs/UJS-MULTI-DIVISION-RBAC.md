# UJS Multi-Division RBAC & Data Governance Framework

Enterprise access-control design for **Uttarakhand Jal Sansthan (UJS)** on the EGIP platform — covering GIS, ERP, Construction, O&M, Consumer Billing, SCADA, Asset Management, and statewide monitoring.

---

## 1. Design principles

| Principle | Implementation |
|-----------|----------------|
| **Defense in depth** | JWT auth → permission guard → data-scope guard → optional PostgreSQL RLS |
| **Least privilege** | Division users see only their division; SE sees circle; State HQ sees all |
| **Inheritance** | `project_id` → `division_id` → `circle_id` → `tenant_id` |
| **Deny by default** | Missing scope assignment returns empty result sets, not errors on list APIs |
| **Audit everything** | Login, cross-division attempts, approvals, billing, GIS edits |
| **Graceful rollout** | Schema-ready checks; modules enforce scope incrementally |

---

## 2. Organizational hierarchy

```
Tenant (UJS)
└── State Headquarters (Dehradun)          ← statewide view
    ├── Circle — Garhwal                   ← SE scope
    │   ├── Chamoli Division
    │   ├── Dehradun Division
    │   ├── Haridwar Division
    │   ├── Pauri Division
    │   ├── Tehri Division
    │   └── Uttarkashi Division
    └── Circle — Kumaon                    ← SE scope
        ├── Almora Division
        └── Nainital Division
```

### Access scope levels

| Level | Code | Who | Data visible |
|-------|------|-----|--------------|
| **Division** | `division` | JE, AE, EE, Accounts, GIS Operator, Billing Officer, O&M Operator, etc. | Own division only |
| **Circle** | `circle` | Superintending Engineer (SE) | All divisions under assigned circle |
| **State** | `state` | CE, CGM, MD, State Finance, State GIS/IT Admin | All divisions statewide |
| **Global** | `global` | Super Administrator | Unrestricted + system configuration |

HQ division flag (`is_headquarters`) and permissions `state:view_all` / `division:view_all` grant State-level access.

---

## 3. Data tagging model

Every operational record inherits scope through foreign keys:

```
tenant_id          (mandatory — multi-tenant isolation)
    └── circle_id      (on divisions, users; derived on child records)
        └── division_id  (on users, projects, assets, consumers, documents)
            └── project_id / scheme_id
                └── asset_id, document_id, bill_id, complaint_id, …
```

### Tagging rules

| Entity | Primary scope column | How derived |
|--------|---------------------|-------------|
| Projects / Schemes | `division_id` | Set at creation; HQ may assign |
| GIS features / assets | `division_id` | From parent project or direct assignment |
| MB, DPR, BOQ, RA Bills | via `project_id` | Join `projects.division_id` |
| O&M complaints, PM, breakdowns | via `project_id` or `asset_id` | Cascade from asset/project |
| Consumers / meters / bills | `division_id` | From service area / project |
| Documents | `division_id` + `resource_type` | Linked to parent entity |
| Workflow tasks | `assigned_role` + entity scope | Role + division of parent record |

**Mandatory rule:** If `Project.division_id = Chamoli`, only Chamoli division users (and circle/state/global roles) may access it.

---

## 4. Access resolution algorithm

Executed on every API request (after JWT validation):

```
1. IF super_admin OR accessScope = 'global' → allow all tenant data
2. IF state:view_all OR division:view_all OR is_headquarters → allow all divisions in tenant
3. IF circle:view AND user.circle_id set → allow divisions WHERE division.circle_id = user.circle_id
4. IF user.division_id set → allow records WHERE division_id = user.division_id
5. ELSE → deny (403 on detail; empty list on queries)
```

For project-scoped modules:

```
assertProjectAccess(user, projectId):
  projectDivision = projects.division_id
  accessibleDivisions = resolveAccessibleDivisionIds(user)
  IF accessibleDivisions is NULL → allow (state/global)
  IF projectDivision IN accessibleDivisions → allow
  ELSE → 403 + log security_event
```

Implementation: `DivisionAccessService` in `backend/api/src/modules/divisions/division-access.service.ts`.

---

## 5. Role-based access matrix

Permissions use `resource:action` format. Roles are tenant-scoped.

### State level

| Role | Code | Scope | Key permissions |
|------|------|-------|-----------------|
| Managing Director | `md` | State | `state:view_all`, `dashboard:read`, `report:export` |
| Chief General Manager | `cgm` | State | `state:view_all`, `project:approve`, `finance:read` |
| Chief Engineer | `ce` | State | `state:view_all`, `construction:approve`, `om:approve` |
| State Finance Controller | `state_finance` | State | `state:view_all`, `finance:*`, `billing:read` |
| State GIS Administrator | `state_gis_admin` | State | `state:view_all`, `layer:*`, `asset:*` |
| State IT Administrator | `state_it_admin` | Global config | `tenant:*`, `user:*`, `audit:read` |

### Circle level

| Role | Code | Scope | Key permissions |
|------|------|-------|-----------------|
| Superintending Engineer | `se` | Circle | `circle:view`, `project:read`, `construction:approve`, `om:read`, `billing:read` |

### Division level

| Role | Code | Can | Cannot |
|------|------|-----|--------|
| Executive Engineer | `ee` | Final technical/financial approval, contractor mgmt, project closure | Other divisions |
| Assistant Engineer | `ae` | Review MB, verify site/GIS, approve JE submissions | Other divisions, final financial approval |
| Junior Engineer | `je` | DPR, MB entries, GIS capture, inspections, maintenance requests | Approve MB/bills, other divisions |
| Accounts Officer | `accounts` | RA bills, payments, ledgers, financial reports | Other divisions |
| GIS Operator | `gis_operator` | GIS layers, asset locations, survey upload | Other divisions |
| Billing Officer | `billing_officer` | Consumer billing, meters, demand, collection | Other divisions |
| O&M Operator | `om_operator` | Complaints, tickets, breakdown, PM schedules | Other divisions |
| SCADA Operator | `scada_operator` | SCADA dashboards, alerts | Other divisions |
| Store Keeper | `store_keeper` | Inventory, store issues | Other divisions |
| Consumer Service Officer | `consumer_service` | Consumer portal support, complaints | Other divisions |

### External

| Role | Code | Scope |
|------|------|-------|
| Contractor | `contractor` | Assigned projects only |
| Consultant | `consultant` | Assigned projects (read + submit) |
| Third Party Inspector | `inspector` | Assigned inspections |
| Laboratory User | `lab_user` | Water quality samples for assigned division |
| VWSC | `vwsc` | Village scheme (limited portal) |
| Consumer | `consumer` | Own consumer account (`portalType: consumer`) |

### Super Administrator

| Role | Code | Scope |
|------|------|-------|
| Super Admin | `super_admin` | Unrestricted — bypasses all scope checks |

---

## 6. Module-level security map

Each module inherits division scope via `project_id` or direct `division_id`.

| Module | Scope key | Guard status | Priority |
|--------|-----------|--------------|----------|
| Projects / Schemes | `division_id` | ✅ Implemented | — |
| Construction / DPR / MB | `project_id` | ✅ `ProjectDivisionGuard` | — |
| Milestones | `project_id` | ✅ Guard | — |
| O&M Billing | `project_id` | ✅ Service layer | — |
| O&M (inspections, complaints, SCADA) | `project_id` | 🔶 Partial | P1 |
| GIS / Feature classes | `project_id` / `division_id` | ❌ Tenant only | P1 |
| Assets | `division_id` | ❌ | P1 |
| Dashboard / Analytics | scope level | ❌ | P2 |
| Documents | `division_id` | ❌ | P2 |
| Finance / ERP | `division_id` | ❌ | P2 |
| Inventory / Store | `division_id` | ❌ | P3 |
| Procurement | `division_id` | ❌ | P3 |
| Workflows (inbox) | role + scope | 🔶 Role only | P1 |
| Users / Roles admin | `tenant_id` | State IT / Super Admin | P2 |

Legend: ✅ Done · 🔶 Partial · ❌ Not yet · P1/P2/P3 = implementation priority

---

## 7. GIS security

All GIS layers inherit division from parent project or asset:

| Layer group | Scope inheritance |
|-------------|-------------------|
| Sources, Intake, Mains, Reservoirs | `project_id` → `division_id` |
| Valve chambers, pump houses, transformers | Asset registry → `division_id` |
| Distribution network, FHTC | Project or O&M asset scope |

Map tile and WFS requests must filter by `accessibleDivisionIds` from JWT scope resolution.

---

## 8. Document security

| Document type | Access rule |
|---------------|-------------|
| DPR, BOQ, Drawings, MB, Bills | Division of parent project |
| Agreements, Completion certificates | Division + role (`construction:approve`) |
| O&M reports | Division of asset/project |
| State policy documents | `state:view_all` |

Future: `documents` table with `division_id`, `classification` (public/internal/restricted), and signed PDF hash.

---

## 9. Database security architecture

### Layer 1 — Application (current, primary)

- NestJS `JwtAuthGuard` + `PermissionsGuard`
- `ProjectDivisionGuard` on project-scoped routes
- `DivisionAccessService` for query scoping

### Layer 2 — PostgreSQL RLS (planned)

Session variables set per request:

```sql
SET app.current_tenant = '<tenant_uuid>';
SET app.current_user = '<user_uuid>';
SET app.accessible_divisions = '<uuid1,uuid2,...>';  -- empty = deny
SET app.scope_level = 'division|circle|state|global';
```

RLS policy pattern:

```sql
CREATE POLICY division_isolation ON projects
  USING (
    tenant_id = current_setting('app.current_tenant')::uuid
    AND (
      current_setting('app.scope_level') IN ('state', 'global')
      OR division_id = ANY(string_to_array(current_setting('app.accessible_divisions'), ',')::uuid[])
    )
  );
```

### Layer 3 — ABAC overrides

`user_access_grants` table for temporary cross-division access (audited, time-bound):

```sql
user_id, resource_type, resource_id, division_id, granted_by, expires_at, reason
```

### Layer 4 — MFA & session

- `users.mfa_enabled` (schema exists)
- Session revocation via JWT blocklist (Redis) — planned
- Digital signature on approvals — workflow extension

---

## 10. Audit & monitoring

### Events to log

| Category | Actions |
|----------|---------|
| Authentication | `auth.login`, `auth.logout`, `auth.mfa`, `auth.failed` |
| Authorization | `access.denied`, `access.cross_division` |
| Data | `*.create`, `*.update`, `*.delete` per module |
| Workflow | `workflow.submit`, `workflow.approve`, `workflow.reject` |
| Financial | `billing.generate`, `payment.verify`, `ra_bill.approve` |
| GIS | `asset.create`, `layer.publish`, `feature.update` |

### Tables

- `audit_logs` — general activity (exists)
- `security_events` — unauthorized access attempts (migration 047)

### Reports

- Division access report (who accessed what division)
- Failed login / denied access dashboard
- Approval chain audit trail

---

## 11. Dashboard security

| Dashboard | Scope filter |
|-----------|--------------|
| Division | `division_id = user.division_id` |
| Circle | `circle_id = user.circle_id` |
| State | All divisions — comparative KPIs |
| Super Admin | Full tenant + system metrics |

---

## 12. JWT payload (staff)

```typescript
{
  sub, email, tenantId,
  roles: string[],
  permissions: string[],
  divisionId, divisionCode, divisionName,
  circleId, circleCode, circleName,      // migration 047+
  accessScope: 'division' | 'circle' | 'state' | 'global',
  canViewAllDivisions: boolean
}
```

---

## 13. Implementation roadmap

### Phase 0 — Foundation (current)

- [x] `divisions` table, `users.division_id`, `projects.division_id`
- [x] `DivisionAccessService`, `ProjectDivisionGuard`
- [x] Projects + Construction + O&M Billing scoping
- [ ] **Apply migration 046** (blocking — see `POSTGRES-WINDOWS-SETUP.md`)

### Phase 1 — Governance framework (migration 047)

- [ ] `circles` table, `circle_id` on divisions/users
- [ ] Full UJS division seed (9 divisions)
- [ ] State + Circle roles and permissions
- [ ] Circle-level scope in `DivisionAccessService`
- [ ] `security_events` table

### Phase 2 — Module rollout (P1)

- [ ] GIS / feature-classes division guard
- [ ] O&M modules (inspections, complaints, SCADA, WQ)
- [ ] Asset registry division column + scoping
- [ ] Workflow inbox filtered by accessible projects

### Phase 3 — Enterprise hardening (P2)

- [ ] Document management with division scope
- [ ] Dashboard APIs per scope level
- [ ] RLS policies + request-scoped session variables
- [ ] MFA enforcement for State/Circle roles
- [ ] Global audit interceptor

### Phase 4 — ABAC & compliance (P3)

- [ ] `user_access_grants` temporary overrides
- [ ] Digital signature on approvals
- [ ] Division access compliance reports
- [ ] Consumer/VWSC portal isolation

---

## 14. Applying the framework

```powershell
# 1. Fix table ownership (if needed) in pgAdmin as postgres:
ALTER TABLE users OWNER TO egip;

# 2. Apply division + governance migrations
cd backend\api
npm run setup:divisions          # migration 046
node scripts/apply-sql-migrations.js 047

# 3. Verify
node scripts/check-division-schema.js

# 4. Restart API and re-login all users
```

---

## 15. Example scenarios

### Chamoli JE views Maa Badhangarhi scheme

- Project `division_id` = Chamoli
- JE `division_id` = Chamoli → **allowed**
- Haridwar JE → **403 Forbidden**

### Garhwal SE reviews Tehri + Dehradun progress

- SE `circle_id` = Garhwal, permission `circle:view`
- Accessible divisions = all where `circle_id` = Garhwal
- Nainital (Kumaon circle) → **not visible**

### Chief Engineer statewide dashboard

- Role `ce` with `state:view_all`
- `accessScope` = `state`
- All divisions visible; comparative KPIs enabled

---

## Related files

| File | Purpose |
|------|---------|
| `database/migrations/046_ujs_divisions_access.sql` | Divisions foundation |
| `database/migrations/047_ujs_rbac_governance_framework.sql` | Circles, roles, permissions |
| `backend/api/src/modules/divisions/division-access.service.ts` | Scope resolution |
| `backend/api/src/common/guards/project-division.guard.ts` | Route guard |
| `backend/api/src/common/guards/permissions.guard.ts` | RBAC guard |

---

*This document is the authoritative design reference for UJS multi-division RBAC on EGIP. Implementation status is tracked in Phase sections above.*
