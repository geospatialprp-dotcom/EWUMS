# Demo Data Setup — Dehradun & Haridwar Presentation

**Purpose:** Populate https://ewumsujs.com (or local dev) with realistic UJS data for department meeting demo.  
**Implementer:** PRP Geospatial Solutions  
**Prerequisite:** All database migrations through **084_dehradun_field_divisions.sql**

---

## 1. Overview

The platform already includes demo data for Karanprayag and Nainital divisions. This guide adds **Dehradun North (DIV-DNN)** and **Haridwar Rural (DIV-HRR)** presentation data — schemes, users, assets, billing, workflows, and audit entries.

| Item | Value |
|------|-------|
| Tenant ID | `a0000000-0000-0000-0000-000000000001` |
| Dehradun North Division | `d1000000-0000-0000-0000-000000000022` (DIV-DNN) |
| Haridwar Rural Division | `d1000000-0000-0000-0000-000000000026` (DIV-HRR) |
| Haridwar Division (legacy) | `d1000000-0000-0000-0000-000000000002` (DIV-HRW) |
| Seed SQL file | `docs/ujs-presentation/demo-seed.sql` |

---

## 2. Quick Start (5 Steps)

### Step 1 — Ensure PostgreSQL is running

```powershell
# From project root (Windows)
.\scripts\start-dev.ps1
```

Or with Docker:

```powershell
docker compose up -d postgres
```

### Step 2 — Apply all migrations (if fresh database)

Run migrations `001` through `084` in order from `database/migrations/`. Your project's migration runner or init scripts should handle this; minimum required: platform schema, seed data (002), workflows (003), construction (012–013), UJS divisions (046–047, 049, 084), O&M billing (041), DPR (060), executive dashboard access (081).

### Step 3 — Run presentation seed

```powershell
# Docker
docker compose exec -T postgres psql -U egip -d egip -f /path/to/demo-seed.sql

# Or direct psql (adjust connection)
psql -U egip -d egip -f docs/ujs-presentation/demo-seed.sql
```

**Windows example from repo root:**

```powershell
Get-Content docs\ujs-presentation\demo-seed.sql | docker compose exec -T postgres psql -U egip -d egip
```

### Step 4 — Start backend (real API, not mock)

```powershell
cd backend\api
npm run start:dev
```

Ensure `dev:mock` is **not** running — the dashboard requires PostgreSQL.

### Step 5 — Verify logins

| User | Password | What to check |
|------|----------|---------------|
| admin@egip.local | Admin@123 | Executive Dashboard — statewide KPIs |
| ee.dnn@egip.local | EE@123 | Only Dehradun North schemes |
| je.dnn@egip.local | JE@123 | Clement Town construction + workflow inbox |
| ee.hrr@egip.local | EE@123 | Bahadarabad scheme + billing |

---

## 3. What the Seed Creates

### 3.1 Users (Division Teams)

**Dehradun North (DIV-DNN):**

| Email | Role | Password |
|-------|------|----------|
| ee.dnn@egip.local | Executive Engineer | EE@123 |
| je.dnn@egip.local | Junior Engineer | JE@123 |
| ae.dnn@egip.local | Assistant Engineer | AE@123 |
| accounts.dnn@egip.local | Accounts Officer | Accounts@123 |

**Haridwar Rural (DIV-HRR):**

| Email | Role | Password |
|-------|------|----------|
| ee.hrr@egip.local | Executive Engineer | EE@123 |
| je.hrr@egip.local | Junior Engineer | JE@123 |
| ae.hrr@egip.local | Assistant Engineer | AE@123 |
| accounts.hrr@egip.local | Accounts Officer | Accounts@123 |

### 3.2 Projects (Schemes)

| Code | Name | Division | Progress |
|------|------|----------|----------|
| PRJ-DNN-CTWSS-26 | Clement Town Water Supply Scheme | Dehradun North | 72% physical / 65% financial |
| PRJ-HRR-BHD-26 | Bahadarabad Rural WSS | Haridwar Rural | 55% physical / 48% financial |

Each project includes milestones, BOQ items (subset), sample assets, and GIS coordinates in the correct district envelope.

### 3.3 Construction & Approvals

- Work packages for gravity main and reservoir components  
- Sample MB (measurement book) with verified entries  
- RA Bill #1 for Clement Town — status `pending_ae` (demo approval chain)  
- DPR proposal for Clement Town extension — stage `tac_review`  

### 3.4 O&M & Billing

- 25 consumers per scheme (FHTC connections)  
- Tariff slab (domestic APL)  
- 3 months meter readings + generated bills  
- 2 payment receipts (collection demo)  

### 3.5 GIS Assets

Assets placed in **Dehradun** (~78.05, 30.32) and **Haridwar** (~78.08, 29.95) coordinates:

- GLSR, pump house, gravity main pipeline, air valve, FHTC points  
- Linked to project via `project_id` for division-scoped dashboard  

### 3.6 IoT & Alerts

- 2 IoT devices on Clement Town pump house and reservoir  
- 2 unacknowledged alerts (pressure low, level warning) — visible on Executive Dashboard  

### 3.7 Audit Trail

- 15 sample audit log entries covering login, MB create, RA bill submit, map layer view, workflow approve  

---

## 4. Demo Walkthrough Paths

### Path A — HQ Executive (5 min)

1. Login: `admin@egip.local`  
2. **Executive Dashboard** — KPIs, charts, critical assets, alerts  
3. **Platform Modules** — show 21 modules  
4. **Map Explorer** — Dehradun district boundary, toggle asset layers  

### Path B — Division Construction (7 min)

1. Login: `je.dnn@egip.local`  
2. **Projects** → Clement Town WSS → Construction  
3. Show dashboard, MB, BOQ reconciliation  
4. **Workflow Inbox** — pending RA bill  
5. Logout → `ae.dnn@egip.local` → approve task  

### Path C — Revenue & Consumer (5 min)

1. Login: `accounts.hrr@egip.local`  
2. **Billing** → Revenue KPI dashboard  
3. Open consumer bill for `FHTC-HRR-DEMO-001`  
4. Optional: Consumer portal `/consumer` with mobile `9876500101`  

---

## 5. Division Reference (Migration 084)

All Dehradun field divisions configured in migration 084:

| Code | Division Name | District |
|------|---------------|----------|
| DIV-DRP | Dehradun Raipur Division | Dehradun |
| DIV-DNN | Dehradun North Division | Dehradun |
| DIV-DNS | Dehradun South Division | Dehradun |
| DIV-DPW | Dehradun Pithuwala Division | Dehradun |
| DIV-DRL | Dehradun Rural Division | Dehradun |
| DIV-HRR | Haridwar Rural Division | Haridwar |
| DIV-HLW | Haldwani Division | Nainital |
| DIV-RMG | Ramnagar Division | Nainital |
| DIV-GSL | Ghansali Division | Tehri Garhwal |

---

## 6. Troubleshooting

| Problem | Solution |
|---------|----------|
| Dashboard shows "Could not load dashboard data" | Stop mock mode; start PostgreSQL backend |
| Empty KPIs (all zeros) | Run `demo-seed.sql`; check assets have `project_id` set |
| Division user sees no projects | Verify `user_division_assignments` and `projects.division_id` |
| Map shows wrong location | Confirm migration 062/064 district boundaries applied |
| Login fails | Run migration 014 (`014_reset_demo_passwords.sql`) |
| Duplicate key errors on re-run | Seed uses `ON CONFLICT` — safe to re-run; delete custom test data if needed |

---

## 7. Reset Demo Data (Optional)

To remove only presentation seed records (keep core platform data):

```sql
-- Run manually — adjust IDs if customised
DELETE FROM ra_bill_lines WHERE ra_bill_id IN (
  SELECT id FROM ra_bills WHERE project_id IN (
    'f0000000-0000-0000-0000-000000000030',
    'f0000000-0000-0000-0000-000000000031'
  )
);
DELETE FROM ra_bills WHERE project_id IN ('f0000000-0000-0000-0000-000000000030', 'f0000000-0000-0000-0000-000000000031');
DELETE FROM projects WHERE id IN ('f0000000-0000-0000-0000-000000000030', 'f0000000-0000-0000-0000-000000000031');
DELETE FROM users WHERE email LIKE '%.dnn@egip.local' OR email LIKE '%.hrr@egip.local';
```

---

## 8. Production (ewumsujs.com) Notes

- Run seed on staging first; review with UJS EE before production  
- Change default passwords after first login in production  
- No secrets or API keys in `demo-seed.sql` — safe for repository  
- PRP Geospatial manages hosting; contact support for production seed assistance  

---

## 9. Related Files

| File | Purpose |
|------|---------|
| `demo-seed.sql` | SQL seed script (this folder) |
| `EXECUTIVE-DASHBOARD-SPEC.md` | Dashboard widget specification |
| `PRESENTATION-OUTLINE.md` | Slide-by-slide meeting script |
| `PILOT-PLAN-90-DAYS.md` | Formal pilot submission |
| `database/migrations/084_dehradun_field_divisions.sql` | Division master data |

---

*Demo setup guide v1.0 — PRP Geospatial Solutions / EWUMS for UJS.*
