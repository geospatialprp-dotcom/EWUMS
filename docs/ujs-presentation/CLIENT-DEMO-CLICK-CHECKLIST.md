# Client Demo Video — Click-by-Click Recording Checklist

**Use with:** [`CLIENT-DEMO-VIDEO-SCRIPT.md`](./CLIENT-DEMO-VIDEO-SCRIPT.md)  
**URL:** https://ewumsujs.com (or VPS)  
**Record at:** 1920×1080 · rehearse once before final take

Print this page or keep it on a second monitor while recording.

**Hindi narration:** use [`CLIENT-DEMO-VIDEO-SCRIPT-HINDI.md`](./CLIENT-DEMO-VIDEO-SCRIPT-HINDI.md) — lower-third labels in Hindi are included there per scene.

---

## Global

- [ ] Deployed latest code on VPS (`vps-deploy-feat-secretariat.sh`)
- [ ] Hard refresh after deploy (Ctrl+Shift+R)
- [ ] Browser zoom 100%, bookmarks hidden
- [ ] Start screen recorder **before** Scene 1 login

---

## Scene 1 — Platform intro (0:45)

**Login:** `admin@egip.local` / `Admin@123`

| Step | Action |
|------|--------|
| 1 | Open login page → enter credentials → Sign in |
| 2 | Sidebar → **Platform** (or navigate to `/platform`) |
| 3 | Slow scroll through module cards top to bottom |
| 4 | Hover **DPR & Planning** card → click to show it exists (optional) |
| 5 | Return to platform overview for voiceover close |

**Lower third:** `Super Admin — 21 Integrated Modules`

---

## Scene 2 — Executive dashboard (0:45)

**Stay logged in as admin**

| Step | Action |
|------|--------|
| 1 | Sidebar → **Dashboard** (`/dashboard`) |
| 2 | Pause on KPI row (assets, projects, alerts) |
| 3 | Point cursor at **Project progress** chart |
| 4 | Mention Tharali / Karanprayag if visible in chart |
| 5 | Optional: click one project bar (do not drill too deep) |

**Lower third:** `Executive Dashboard — Live KPIs`

---

## Scene 3 — DPR pipeline (1:15)

### Part A — EE view

**Logout → Login:** `ee.kpg@egip.local` / `EE@123`

| Step | Action |
|------|--------|
| 1 | Sidebar → **DPR & Planning** (`/dpr-planning`) |
| 2 | Click proposal **`DPRP-2026-27-KPG-0001`** (Tharali) |
| 3 | Show **12-stage stepper** — pause on current stage |
| 4 | Read **status chip** (e.g. Secretariat examination / TAC Round 2) |
| 5 | Click **Stage 3 — DPR Preparation** in stepper or actions |
| 6 | Show document uploads / BOQ section |
| 7 | Point at **LA readiness** chip or link if visible |
| 8 | Open **Workflow track** / history panel if available |

**Lower third:** `EE — 12-Stage DPR Pipeline`

### Part B — Secretariat cut (15 sec)

**Logout → Login:** `secretariat@egip.local` / `Sec@123`

| Step | Action |
|------|--------|
| 1 | Lands on `/dpr-planning` automatically |
| 2 | Open same proposal `DPRP-2026-27-KPG-0001` |
| 3 | Show Stage 7 / Secretariat examination view |
| 4 | Note: sidebar should **not** show Construction or Billing |

**Lower third:** `Secretariat — Scoped DPR Access`

---

## Scene 4 — Land acquisition (0:50)

**Logout → Login:** `ee.kpg@egip.local` / `EE@123`

| Step | Action |
|------|--------|
| 1 | Sidebar → **Land Acquisition** (`/land-acquisition`) |
| 2 | Click **Tharali** case (linked to DPR GIS workspace) |
| 3 | Show case **status pipeline** / step list |
| 4 | Open **GIS workspace** or map trace tab |
| 5 | Show parcel intersection / clearance steps (scroll if needed) |
| 6 | Return to case summary — show linkage to DPR |

**If LA case missing:** run `vps-setup-la-tharali-demo.sql` or EE → DPR Stage 3 → Create LA Case.

**Lower third:** `Land Acquisition — GIS-Driven`

---

## Scene 5 — Construction lifecycle (1:30)

### Part A — Contractor (0:40)

**Logout → Login:** `contractor@egip.local` / `Contractor@123`

| Step | Action |
|------|--------|
| 1 | Sidebar → **Projects** → open **Tharali Pinder Paar WSS** |
| 2 | Click **Construction** (or `/projects/{id}/construction`) |
| 3 | Tab: **Daily Progress** — show DPR list |
| 4 | Optional: click **New DPR** briefly (do not need to save) |
| 5 | Tab: **GIS Assets** |
| 6 | Click **Register Asset** |
| 7 | Show dialog: Asset ID, GPS button, **Capture live photo at site** |
| 8 | Tab: **RA Bills** — show bill list / status |

**Lower third:** `Contractor — Site DPR & GIS Registration`

### Part B — JE (0:25)

**Logout → Login:** `je.kpg@egip.local` / `JE@123`

| Step | Action |
|------|--------|
| 1 | Projects → Tharali → Construction |
| 2 | Tab: **Daily Progress** — show submitted DPRs |
| 3 | Tab: **Measurement Book** — open MB (e.g. MB 11) |
| 4 | Show work items with L1 BOQ rates |
| 5 | Tab: **BOQ Reconciliation** — show quantities vs BOQ |
| 6 | If pending: click **Submit** or show verify actions |

**Lower third:** `JE — Measurement Book`

### Part C — AE (0:15)

**Logout → Login:** `ae.kpg@egip.local` / `AE@123`

| Step | Action |
|------|--------|
| 1 | Same project → Construction |
| 2 | MB tab — show **Approve** / pending chip |
| 3 | RA Bills tab — show bill at AE verification step |
| 4 | Click approve if demo data allows (or show button only) |

**Lower third:** `AE — Technical Verification`

### Part D — Accounts (0:10)

**Logout → Login:** `accounts.kpg@egip.local` / `Accounts@123`

| Step | Action |
|------|--------|
| 1 | Same project → RA Bills |
| 2 | Open RA bill at **Step 5 — Finance Release** |
| 3 | Show approval chain chips JE → AE → EE → Finance |

**Lower third:** `Finance — RA Bill Release`

---

## Scene 6 — GIS map (0:40)

**Logout → Login:** `ee.kpg@egip.local` / `EE@123` (or `gis@egip.local`)

| Step | Action |
|------|--------|
| 1 | Sidebar → **Map** (`/map`) |
| 2 | Pan/zoom to **Karanprayag / Chamoli** area |
| 3 | Open **layer panel** — toggle pipeline / reservoir / FHTC |
| 4 | Click **identify** tool → click a feature on map |
| 5 | Show attribute popup (project link, asset type) |

**Lower third:** `GIS — Division-Scoped Layers`

---

## Scene 7 — O&M, billing, portal (1:15)

### Part A — Complaints (0:20)

**Login:** `je.kpg@egip.local` / `JE@123`

| Step | Action |
|------|--------|
| 1 | Sidebar → **Complaints** (`/complaints`) |
| 2 | Open a demo complaint (Tharali Ward if seeded) |
| 3 | Show status, SLA, assignment |

### Part B — O&M (0:15)

| Step | Action |
|------|--------|
| 1 | Sidebar → **O&M** (`/om`) |
| 2 | Brief scroll through stage tabs (handover, PM, SCADA) |

### Part C — Billing (0:25)

**Logout → Login:** `accounts.kpg@egip.local` / `Accounts@123`

| Step | Action |
|------|--------|
| 1 | Sidebar → **Billing** (`/billing`) |
| 2 | Tab: **Bills** — show generated bills |
| 3 | Tab: **Accounting** — show ERP / GL view |

### Part D — Jal Mitra (0:15)

| Step | Action |
|------|--------|
| 1 | Open new tab → `/portal/login` |
| 2 | Enter FHTC: `FHTC-DEMO-001` |
| 3 | Enter mobile: `9876543210` → request OTP → enter OTP |
| 4 | Show consumer dashboard — bill + complaint option |

**Lower third:** `Jal Mitra — Citizen Portal`

---

## Scene 8 — Outro (add in editor)

| Step | Action |
|------|--------|
| 1 | Add title card: **EWUMS — ewumsujs.com** |
| 2 | PRP Geospatial Solutions logo |
| 3 | Optional: QR code to portal |

---

## Troubleshooting during recording

| Problem | Fix |
|---------|-----|
| DPR list empty | Run migration 104 / `vps-migrate-104-dpr-progress.sh` |
| Contractor no GIS tab | Deploy latest branch; hard refresh |
| LA case not linked | `vps-setup-la-tharali-demo.sql` |
| RA bill not at Finance step | Complete JE→AE→EE approvals in Construction tab |
| Dashboard empty | Ensure real API running (not mock); PostgreSQL up |
| Portal OTP fails | Check migration `043_consumer_portal_demo.sql` |

---

## File naming after export

| Version | Filename |
|---------|----------|
| Full | `EWUMS-Client-Demo-7min-v1.mp4` |
| Short | `EWUMS-Client-Demo-5min-v1.mp4` |
| Elevator | `EWUMS-Client-Demo-2min-v1.mp4` |
| With Hindi dub | `EWUMS-Client-Demo-7min-Hindi-v1.mp4` |

---

*Recording checklist v1.0 — PRP Geospatial Solutions*
