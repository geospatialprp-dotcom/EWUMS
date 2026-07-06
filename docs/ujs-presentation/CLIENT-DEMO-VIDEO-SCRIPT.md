# Client Demo Video — Voiceover Script & Production Guide

**Product:** EWUMS — Enterprises Water Utility Management System (S2T2R)  
**Audience:** UJS clients, division heads, government stakeholders  
**Duration:** 7 minutes (full) · 5 minutes (short) · 2 minutes (elevator)  
**Hero scheme:** Tharali Pinder Paar WSS — Karanprayag (`PRJ-TPPWSS-2026-27`)  
**Platform URL:** https://ewumsujs.com (or your VPS host)  
**Implementer:** PRP Geospatial Solutions

**Companion doc:** [`CLIENT-DEMO-CLICK-CHECKLIST.md`](./CLIENT-DEMO-CLICK-CHECKLIST.md) — exact clicks for the person recording.  
**Hindi voiceover:** [`CLIENT-DEMO-VIDEO-SCRIPT-HINDI.md`](./CLIENT-DEMO-VIDEO-SCRIPT-HINDI.md) — पूर्ण हिंदी वॉयसओवर (7 / 5 / 2 min).

---

## 1. Pre-recording checklist

### Environment

- [ ] Chrome or Edge, **1920×1080**, zoom **100%**
- [ ] Hide bookmarks bar; use a clean browser profile
- [ ] Microphone tested; record in a quiet room
- [ ] Screen recorder: OBS Studio, Loom, or Camtasia
- [ ] Export target: **1080p MP4**, H.264, voice dominant (music ≤10% volume if used)

### VPS / demo data (Karanprayag track)

Run on VPS **before** recording:

```bash
bash /opt/egip/database/scripts/vps-deploy-feat-secretariat.sh
```

Optional LA linkage (if Stage 3 / LA demo needs it):

```bash
docker compose -f /opt/egip/deploy/hostinger-kvm/docker-compose.prod.yml --env-file /opt/egip/deploy/hostinger-kvm/.env \
  exec -T postgres psql -U egip -d egip -v ON_ERROR_STOP=1 \
  < /opt/egip/database/scripts/vps-setup-la-tharali-demo.sql
```

Verify DPR proposal exists: `DPRP-2026-27-KPG-0001`

### After deploy

- [ ] Log out all sessions → **Ctrl+Shift+R** (hard refresh)
- [ ] Rehearse once with click checklist
- [ ] Prepare lower-third labels: role name + module (e.g. “JE — Measurement Book”)

---

## 2. Demo credentials

| Role | Email | Password | Used in scene |
|------|-------|----------|---------------|
| Super Admin | `admin@egip.local` | `Admin@123` | 1, 2 |
| EE Karanprayag | `ee.kpg@egip.local` | `EE@123` | 3, 4, 6 |
| Secretariat | `secretariat@egip.local` | `Sec@123` | 3 (cut) |
| Contractor | `contractor@egip.local` or `c.negi@egip.local` | `Contractor@123` | 5 |
| JE Karanprayag | `je.kpg@egip.local` | `JE@123` | 5, 7 |
| AE Karanprayag | `ae.kpg@egip.local` | `AE@123` | 5 |
| Accounts | `accounts.kpg@egip.local` | `Accounts@123` | 5, 7 |
| GIS Admin | `gis@egip.local` | `Gis@123` | 6 (alt.) |
| Consumer portal | FHTC `FHTC-DEMO-001` | Mobile OTP `9876543210` | 7 |

---

## 3. Scene overview (7 minutes)

| # | Scene | Time | Login | Route |
|---|--------|------|-------|-------|
| 1 | Platform intro | 0:45 | admin | `/platform` |
| 2 | Executive dashboard | 0:45 | admin | `/dashboard` |
| 3 | DPR approval pipeline | 1:15 | ee.kpg → secretariat | `/dpr-planning` |
| 4 | Land acquisition (GIS) | 0:50 | ee.kpg | `/land-acquisition` |
| 5 | Construction lifecycle | 1:30 | contractor → je → ae → accounts | `/projects/…/construction` |
| 6 | GIS map | 0:40 | ee.kpg | `/map` |
| 7 | O&M, billing, Jal Mitra | 1:15 | je → accounts → portal | `/complaints`, `/billing`, `/portal` |

---

## 4. Full voiceover script (read aloud)

*Tone: confident, clear, suitable for government / utility clients. Pause 2 seconds after each login switch.*

---

### Scene 1 — Opening (0:45)

**Screen:** Login page → Platform modules (`/platform`)  
**Login:** `admin@egip.local` / `Admin@123`

> Welcome to EWUMS — the Enterprises Water Utility Management System, built for Uttarakhand Jal Sansthan.
>
> This is not a collection of separate tools. It is one integrated platform — from the first DPR proposal, through government approval, land acquisition, construction, GIS mapping, operations, billing, and citizen service.
>
> Twenty-one modules share a single database. Each officer sees only what their role requires — and every action is auditable.

**Hindi cue (optional):** *“यह योजना से लेकर O&M और बिलिंग तक — एक ही डिजिटल प्रणाली है।”*

**On screen:** Scroll module groups — Planning & Construction, GIS, O&M, Commercial, Analytics.

---

### Scene 2 — Executive command center (0:45)

**Screen:** `/dashboard`

> Leadership gets a real-time command center — not static slides.
>
> Project progress, asset health, alerts, and division-wise KPIs come directly from the database. Every number is live data from the field and from approvals in the system.
>
> For today’s walkthrough, we follow the Tharali Pinder Paar Water Supply Scheme in Karanprayag division.

**On screen:** Point at KPI cards and project progress; optionally click through to map.

---

### Scene 3 — DPR & government approval (1:15)

**Screen:** `/dpr-planning` → proposal `DPRP-2026-27-KPG-0001`  
**Login:** `ee.kpg@egip.local` / `EE@123`

> Every major scheme starts in the twelve-stage DPR pipeline.
>
> The Division Executive Engineer initiates the proposal. Technical documents, BOQ, drawings, and cost estimates are uploaded stage by stage.
>
> At Stage three, land acquisition readiness is checked — the system tracks LA status before sanction.
>
> The proposal moves through TAC review, revision, Secretariat examination, administrative approval, and tender processing — each stage with workflow status, document control, and a full audit trail.

**On screen:** Twelve-stage stepper, status chip, Stage 3 panel, workflow track.

**Cut (15 sec) — switch login:** `secretariat@egip.local` / `Sec@123`

> Secretariat officers have a scoped view — they see only the DPR pipeline. Here at Stage seven, Secretariat examines the technically cleared package before sanction.

---

### Scene 4 — Land acquisition on GIS (0:50)

**Screen:** `/land-acquisition` → Tharali case  
**Login:** `ee.kpg@egip.local`

> Land acquisition is GIS-driven, not paper-driven.
>
> The pipeline alignment is traced on the map. Cadastral parcels are intersected automatically. Clearance steps — revenue, forest, district magistrate — follow a statutory workflow.
>
> When possession is recorded, construction permission is released. LA status feeds back into the DPR at sanction — one source of truth for planners and field engineers.

**On screen:** LA workspace — map trace, parcel steps, clearance pipeline.

---

### Scene 5 — Construction lifecycle (1:30)

**Screen:** Projects → Tharali → Construction (`PRJ-TPPWSS-2026-27`)

#### 5a — Contractor (0:40)

**Login:** `contractor@egip.local` / `Contractor@123`

> Once the work order is issued, the contractor reports from site.
>
> They submit the Daily Progress Report with photographs. They register GIS assets as installed — live camera photo with automatic GPS geotagging. They raise Running Account bills against verified work.

**On screen:** Daily Progress tab → DPR list; GIS Assets → Register Asset → live photo + GPS; RA Bills tab.

#### 5b — JE (0:25)

**Login:** `je.kpg@egip.local` / `JE@123`

> The Junior Engineer verifies site progress, records measurements in the Measurement Book using L1 contractor BOQ rates, and forwards for approval.

**On screen:** Measurement Book tab → MB entries; BOQ Reconciliation.

#### 5c — AE & Accounts (0:25)

**Login:** `ae.kpg@egip.local` → then `accounts.kpg@egip.local`

> The Assistant Engineer and Executive Engineer verify quantities and rates. Accounts releases payment only after the full approval chain — contractor submits, department verifies, finance pays.

**On screen:** Approve MB / RA bill workflow chips; Finance Release step on RA bill.

---

### Scene 6 — GIS map (0:40)

**Screen:** `/map` — Karanprayag / Chamoli area  
**Login:** `ee.kpg@egip.local`

> Every asset — pipeline, intake, valve, FHTC — lives on the map.
>
> Layers are division-scoped. Officers work inside their jurisdiction. Assets registered during construction appear here automatically. Location is the thread that connects planning, construction, and operations.

**On screen:** Toggle layers; identify tool on a feature.

---

### Scene 7 — Operations, billing & citizen (1:15)

#### 7a — Complaints & O&M (0:35)

**Login:** `je.kpg@egip.local`

> After commissioning, the scheme enters operations. Complaints are logged with SLA tracking. Preventive maintenance, water quality, and SCADA sit in the O&M module.

**On screen:** `/complaints` → demo complaint; brief `/om` overview.

#### 7b — Billing (0:25)

**Login:** `accounts.kpg@egip.local`

> Commercial operations run in Billing and Finance — consumer registers, meter readings, tariffs, bill generation, collection, and ERP accounting.

**On screen:** `/billing` → Bills and Accounting tabs.

#### 7c — Jal Mitra portal (0:15)

**Screen:** `/portal/login` — FHTC `FHTC-DEMO-001`, mobile `9876543210`

> Citizens use Jal Mitra — view bills, pay online, and register complaints from their phone.
>
> From the first DPR line to the last rupee collected — EWUMS covers the full life of a water supply scheme. Thank you.

---

## 5. Five-minute cut

Remove or shorten:

| Drop / shorten | Saves |
|----------------|-------|
| Scene 2 (dashboard) | ~45 sec |
| Scene 4 — one map screenshot only | ~30 sec |
| Scene 6 — 20 sec map flyover | ~20 sec |

**Keep:** Scenes 1 (short), 3, 5, 7 — the **plan → build → operate** story.

---

## 6. Two-minute elevator version

**Use for:** WhatsApp, email attachment, exhibition loop.

| Time | Visual | Voice (condensed) |
|------|--------|-------------------|
| 0:00–0:20 | `/platform` + `/dpr-planning` stepper | “EWUMS is UJS’s end-to-end water utility platform — DPR approval, twelve government stages, full audit trail.” |
| 0:20–0:50 | Construction: contractor DPR + GIS asset + JE MB approve | “Contractors report from site with GPS and photos. JE verifies measurements. RA bills flow JE → AE → EE → Finance.” |
| 0:50–1:20 | `/map` layers + `/billing` + portal | “Every asset on the map. Billing and ERP integrated. Citizens use Jal Mitra for bills and complaints.” |
| 1:20–2:00 | Logo + `ewumsujs.com` | “One platform — plan, build, operate, bill. PRP Geospatial Solutions.” |

**Logins for elevator:** admin (10 sec) → contractor (30 sec) → je (15 sec) → accounts (15 sec) → portal (15 sec) → title card.

---

## 7. Post-production

| Element | Recommendation |
|---------|----------------|
| Lower thirds | Role + module on each login switch |
| Intro card | “EWUMS — Uttarakhand Jal Sansthan” + PRP logo (3 sec) |
| Outro card | `ewumsujs.com` + contact (5 sec) |
| Captions | Hindi SRT (primary); English SRT optional |
| File name | `EWUMS-Client-Demo-7min-Hindi-v1.mp4` (or bilingual) |

---

## 8. Alternate track (Dehradun / Haridwar)

For meetings using `demo-seed.sql` instead of Tharali VPS:

| Item | Value |
|------|-------|
| Setup | `docs/ujs-presentation/demo-seed.sql` |
| Schemes | Clement Town (`PRJ-DNN-CTWSS-26`), Bahadarabad (`PRJ-HRR-BHD-26`) |
| Logins | `je.dnn@egip.local`, `accounts.hrr@egip.local` |
| Guide | `DEMO-DATA-SETUP.md` |

Use the same scene order; swap Tharali for Clement Town in Scenes 5 and 7.

---

## 9. Related files

| File | Purpose |
|------|---------|
| [`CLIENT-DEMO-VIDEO-SCRIPT-HINDI.md`](./CLIENT-DEMO-VIDEO-SCRIPT-HINDI.md) | Hindi voiceover (7 / 5 / 2 min) |
| [`CLIENT-DEMO-CLICK-CHECKLIST.md`](./CLIENT-DEMO-CLICK-CHECKLIST.md) | Step-by-step clicks for recording |
| [`DEMO-DATA-SETUP.md`](./DEMO-DATA-SETUP.md) | Dehradun/Haridwar seed setup |
| [`PRESENTATION-OUTLINE.md`](./PRESENTATION-OUTLINE.md) | 45–60 min department meeting slides |
| `database/scripts/vps-deploy-feat-secretariat.sh` | VPS one-shot deploy |
| `database/scripts/vps-setup-la-tharali-demo.sql` | Tharali LA linkage |

---

*Client demo video package v1.0 — PRP Geospatial Solutions / EWUMS for UJS.*
