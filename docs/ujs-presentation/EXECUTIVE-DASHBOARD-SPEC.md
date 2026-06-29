# Executive Dashboard Specification — EWUMS/UJS Department Demo

**Platform:** [EWUMS](https://ewumsujs.com) (Enterprises Water Utility Management System)  
**Client:** Uttarakhand Jal Sansthan (UJS)  
**Implementer:** PRP Geospatial Solutions  
**Route:** `/dashboard` · **API:** `GET /api/v1/dashboard/executive`  
**Permission:** `dashboard:read` (HQ leadership, SE, EE, JE, AE, Super Admin)

---

## 1. Purpose

The Executive Dashboard is the **Command Center** for department meetings. It gives MD/CGM/CE/SE and division EEs a single-screen view of assets, projects, and IoT alerts — scoped by division when the user is not statewide.

Use this document to rehearse the demo, explain data sources to non-technical officers, and track widgets still to be built.

---

## 2. What Is Live Today (Demo-Ready)

The dashboard is **fully implemented** in code. When PostgreSQL is running with migrations applied, login as `admin@egip.local` / `Admin@123` or `ee@egip.local` / `EE@123` and open **Executive Dashboard** from the sidebar.

### 2.1 Page Layout (Current)

| Zone | Widget | Status | Notes |
|------|--------|--------|-------|
| Header | **Command Center** + division scope subtitle | Live | Shows active division or “Full State Access” for HQ |
| Link | **View all 20 integrated platform modules →** | Live | Links to `/platform` |
| Row 1 | **5 KPI stat cards** | Live | See §3 |
| Row 2 | **Project Progress** bar chart | Live | Top 5 projects by recency |
| Row 2 | **Assets by Status** pie chart | Live | active / critical / other statuses |
| Row 3 | **Critical Assets** table | Live | Top 10 by health score |
| Row 3 | **Recent IoT Alerts** table | Live | Unacknowledged alerts |

**Frontend:** `frontend/web/src/pages/DashboardPage.tsx`  
**Backend:** `backend/api/src/modules/dashboard/dashboard.service.ts`

---

## 3. KPI Cards — Exact Widgets for UJS Demo

These five cards render today. Values come from **live database queries** except trend arrows (currently illustrative placeholders in the service).

| # | KPI Label | Mock / Demo Value* | Data Source | SQL / Table |
|---|-----------|-------------------|-------------|-------------|
| 1 | **Total Assets** | 847 | `assets` | `COUNT(*)` where `tenant_id` + division scope via `project_id` |
| 2 | **Active Alerts** | 3 | `iot_alerts` + `iot_devices` | Unacknowledged alerts, scoped to division projects |
| 3 | **Critical Assets** | 12 | `assets` | `status = 'critical'` OR `health_score < 50` |
| 4 | **Avg Project Progress** | 68% | `projects` | `AVG(physical_progress)` |
| 5 | **Avg Asset Health** | 82% | `assets` | `AVG(health_score)` |

\* *After running `demo-seed.sql`, Dehradun North + Haridwar Rural pilot data will populate realistic counts. Before seeding, counts reflect existing demo projects (Karanprayag, Nainital, etc.).*

### Trend Footers (Presentation Note)

Trend text (`+2.3%`, `-12%`, etc.) is **hardcoded in the API** for visual polish. Tell officers: *“Trend comparison will connect to prior-month snapshots in Phase 2.”*

---

## 4. Charts & Tables

### 4.1 Project Progress (Bar Chart)

- **X-axis:** Project name (max 5)
- **Bars:** Physical % (blue), Financial % (teal)
- **Source:** `projects.name`, `physical_progress`, `financial_progress`
- **Demo talking point:** Compare Clement Town WSS (Dehradun North) vs Bahadarabad WSS (Haridwar Rural) after seeding

### 4.2 Assets by Status (Pie Chart)

- **Segments:** `active`, `critical`, `maintenance`, etc.
- **Source:** `GROUP BY status` on `assets`

### 4.3 Critical Assets Table

| Column | Field |
|--------|-------|
| Code | `asset_code` |
| Name | `name` |
| Type | `asset_types.name` |
| Health | `health_score` % chip |

### 4.4 Recent IoT Alerts Table

| Column | Field |
|--------|-------|
| Severity | `critical` / `warning` chip |
| Device | `iot_devices.name` |
| Message | Alert message |

---

## 5. Division-Wise Cards — Recommended for Phase 2

**Not built yet.** For the department meeting, describe these as the **next sprint** (PRP Geospatial delivery). Use this mock layout on a slide or printed handout:

| Division (Migration 084) | Code | Demo KPIs (Target) |
|--------------------------|------|---------------------|
| Dehradun North Division | DIV-DNN | 2 schemes · 68% avg progress · 412 FHTCs |
| Dehradun South Division | DIV-DNS | 1 scheme · 45% progress · 280 FHTCs |
| Haridwar Rural Division | DIV-HRR | 1 scheme · 55% progress · 350 FHTCs |
| Haridwar Division | DIV-HRW | O&M revenue ₹12.4 L/month · 94% collection |
| Dehradun Raipur Division | DIV-DRP | 3 critical assets · 2 open complaints |

**Implementation approach:** Extend `GET /dashboard/executive` with optional `?groupBy=division` or add `GET /dashboard/executive/divisions` returning an array of per-division KPI objects. Frontend: second row of compact `KpiStatCard` components filtered by Garhwal Circle.

---

## 6. Additional Widgets — Priority for Demo Enhancement

| Priority | Widget | Module | API / Table | Demo Value |
|----------|--------|--------|-------------|------------|
| **P1** | Division summary cards | Dashboard | New endpoint + `divisions`, `projects` | See §5 |
| **P1** | DPR pipeline funnel | DPR Planning | `dpr_proposals` by `status` | 4 in TAC · 2 sanctioned · 1 tender |
| **P1** | Revenue collection % | Billing | O&M billing summary API | 94.2% this month |
| **P2** | Open complaints / SLA | O&M | `om_complaints` | 7 open · 2 breached |
| **P2** | RA bills pending approval | Construction | `ra_bills` + workflow | 3 pending EE sign-off |
| **P2** | GIS map thumbnail | Map | Embedded mini-map | Dehradun district extent |
| **P3** | Land acquisition cases | LA | `la_cases` | 1 active trace |
| **P3** | Water quality compliance | O&M | WQ samples | 98% pass rate |
| **P3** | Audit activity (24h) | Audit | `audit_logs` | 42 actions logged |

---

## 7. Division Scoping Behaviour (Important for Demo)

| User | Sees |
|------|------|
| `admin@egip.local` (Super Admin / HQ) | All divisions statewide |
| `ee@egip.local` (HQ EE) | All divisions (HQ assignment) |
| `ee.dnn@egip.local` (Dehradun North EE) | Only Dehradun North projects/assets |
| `je@egip.local` (Haridwar JE) | Haridwar Division only |

**Demo script:** Log in as division EE → show scoped dashboard → switch to HQ admin → show statewide view. This demonstrates UJS multi-division RBAC.

---

## 8. Related Dashboards (Other Modules)

For a richer demo, navigate from Command Center to:

| Module | Route | Highlights |
|--------|-------|------------|
| Platform Modules | `/platform` | All 21 modules — 17 live, 4 partial |
| Construction Dashboard | `/projects/{id}/construction#dashboard` | Physical/financial progress, milestones |
| O&M Revenue KPIs | `/billing` or `/om` | Collection efficiency, NRW, cost recovery |
| O&M GIS Dashboard | `/om` (GIS tab) | Spatial operational view |
| Map Explorer | `/map` | District-locked basemap, asset layers |

---

## 9. Pre-Demo Checklist

- [ ] PostgreSQL running; all migrations through **084** applied
- [ ] Run `docs/ujs-presentation/demo-seed.sql` for Dehradun/Haridwar data
- [ ] Backend API running (not mock mode)
- [ ] Login tested: HQ + division users
- [ ] Browser: https://ewumsujs.com or local dev URL
- [ ] Division selector set correctly before presenting scoped view

---

## 10. Build Next (Engineering Backlog)

1. **Division-wise KPI row** — highest impact for department meeting follow-up  
2. **Replace hardcoded KPI trends** with month-over-month from snapshot table  
3. **Wire revenue & complaint KPIs** from existing O&M billing APIs  
4. **Drill-down links** — click KPI → filtered project/asset list  
5. **Hindi labels** — reuse `hi.ts` keys for `nav.executiveDashboard` and KPI labels  

---

*Document prepared for UJS department presentation. PRP Geospatial Solutions — EWUMS/S2T2R platform.*
