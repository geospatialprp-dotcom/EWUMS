# AI-Powered Online DPR PDF Review & Redline Correction Module

**Platform:** EWUMS — Uttarakhand Jal Sansthan DPR Platform  
**Status:** Phase 1 foundation scaffolded (2026-06-30)

---

## Phase A — Discovery: What Exists vs Gaps

### 1. DPR PDF generation & submission — **EXISTS (strong)**

| Capability | Location | Notes |
|------------|----------|-------|
| 12-stage DPR pipeline | `backend/api/src/modules/dpr-planning/` | Custom state machine, ~40 REST endpoints |
| Complete DPR PDF upload | `POST .../tac-package/dpr-pdf` | Type `dpr_complete_pdf`, max 50 MB |
| PDF heuristic validation | `utils/dpr-pdf-validation.util.ts` | Header/size/page/keyword scan — not structured parsing |
| Document versioning | `dpr_proposal_documents` | Per-type version history |
| Secured file download | `GET .../documents/:documentId/file` | JWT + division guard + inline stream |
| Stage UI panels | `frontend/web/src/components/dpr/*` | Stage 3 upload, TAC review, revision |
| Workflow audit | `dpr_workflow_events` | Action, comments, JSONB payload |

**Gap:** No in-browser PDF preview — users download only.

### 2. PDF viewers & annotations — **GAPS (greenfield)**

| Exists | Gap |
|--------|-----|
| jsPDF client export (`utils/pdfExport.ts`) | No PDF.js / react-pdf viewer |
| HTML→print PDF for remarks/LA docs | No page-level annotations |
| Local `uploads/dpr-planning/{id}/` storage | No red pen, highlights, stamps, signatures |

### 3. Comments & review — **PARTIAL**

| Exists | Gap |
|--------|-----|
| Proposal-level bilingual remarks (`BilingualRemarkField`) | No PDF-coordinate-anchored threads |
| TAC/HQ checklists in JSONB | No per-annotation discussion |
| `dpr_workflow_events.comments` | No correction workflow states (Open→Closed) |

### 4. Notifications — **GAP**

| Exists | Gap |
|--------|-----|
| Generic workflow inbox (`WorkflowInboxPage`) | DPR does not use workflow instances |
| `alert_notifications` module (O&M) | No DPR stage-change alerts (email/SMS/in-app) |

### 5. GIS integration — **EXISTS (for LA gates, not in-PDF)**

| Capability | Location |
|------------|----------|
| DPR GIS boundary / lat-lng | `dpr_proposals.gis_boundary` |
| LA readiness gates | `land-acquisition.service.ts` → Stage 3 & 8 blocks |
| OpenLayers map | `MapPage.tsx`, `LaMapPanel.tsx` |
| PostGIS parcels/alignment | Migration `070_land_acquisition.sql` |

**Gap:** No GIS overlay on PDF pages; validation is external to document viewer.

### 6. Auth / RBAC — **EXISTS (reuse)**

| Role tier | Codes | DPR usage |
|-----------|-------|-----------|
| Division | `ee`, `je`, `ae` | Initiate, prepare, tender chain |
| HQ / State | `se`, `ce`, `cgm`, `md` | HQ review, TAC, sanction |
| Super admin | `super_admin` | Demo bypass |

Guards: `DprProposalDivisionGuard`, `PermissionsGuard`, `DivisionAccessService`.

Permissions today: `dpr_proposal:read|create|update|approve`.  
Phase 1 adds: `dpr_pdf_review:read|annotate|comment`.

### 7. File storage — **EXISTS (local only)**

Pattern: `uploads/{module}/{resourceId}/{unique-name}` → `/uploads/...` static serve.  
**No MinIO/S3** — abstract later via storage interface.

---

## Phase B — Architecture & Phased Roadmap

### Tech choices

| Layer | Choice | Rationale |
|-------|--------|-----------|
| PDF render | **PDF.js** (`pdfjs-dist`) | Industry standard, works with blob streams from API |
| Annotations | **Canvas overlay** (Phase 1); Fabric.js optional Phase 2 | Minimal deps; geometry stored as JSONB |
| Backend | **NestJS module** `dpr-pdf-review` | Matches existing module pattern |
| DB | **PostgreSQL** new tables | FK to `dpr_proposals`, `dpr_proposal_documents` |
| Auth | Reuse JWT + division guard + new permissions | Consistent with DPR planning |
| Audit | `AuditService.log()` | Same as platform audit trail |

### Phased delivery

#### Phase 1 — MVP (this session) ✅ scaffolded

- PDF.js viewer with red-pen mode default
- Tools: freehand, highlight, sticky note
- Tables: `dpr_pdf_reviews`, `dpr_pdf_annotations`, `dpr_pdf_comments`, `dpr_pdf_versions`
- CRUD annotations + comments API
- Secured PDF stream endpoint
- Review panel sidebar (comment list stub)
- Wire into TAC Review panel entry point
- RBAC: division guard + `dpr_pdf_review:*` permissions

#### Phase 2 — Correction workflow & versions

- Review status machine: `open → assigned → in_review → corrections_pending → resubmitted → verified → closed`
- Smart navigation panel (filter by page, severity, reviewer)
- Version snapshots on DPR resubmit; side-by-side compare (PDF.js dual pane)
- Link annotations to workflow events on TAC return

#### Phase 3 — AI review

- Text extraction pipeline (pdf-parse or external OCR)
- Engineering rule checks (BOQ cross-ref, design standard keywords)
- AI highlight mode: color-coded overlays (`error`, `warning`, `info`)
- Async job queue for large PDFs

#### Phase 4 — GIS validation & auto verification

- Compare DPR GIS boundary vs LA parcel alignment
- Map snapshot attachment as supplementary layer
- Re-run AI + rule checks after correction upload
- Auto-close annotations marked resolved + verified

#### Phase 5 — Dashboard & notifications

- KPIs: open corrections, avg turnaround, reviewer workload
- In-app bell hooks on `dpr_workflow_events`
- Email/SMS via `alert_notifications` patterns
- Paperless redline outcome PDF export (annotated summary)

---

## Database schema sketch

```sql
dpr_pdf_reviews
  id, tenant_id, proposal_id → dpr_proposals
  document_id → dpr_proposal_documents
  status (open|assigned|in_review|corrections_pending|verified|closed)
  reviewer_scope (division|circle|hq)
  assigned_to → users, created_by, timestamps

dpr_pdf_annotations
  id, tenant_id, review_id, proposal_id, document_id
  page_number, annotation_type, geometry JSONB, color, content
  created_by, updated_by, timestamps

dpr_pdf_comments
  id, tenant_id, review_id, annotation_id?, proposal_id
  page_number?, body, parent_id?, created_by, timestamps

dpr_pdf_versions
  id, tenant_id, review_id, proposal_id, document_id
  version_no, label, snapshot_annotations JSONB, created_by, created_at
```

Migration: `database/migrations/094_dpr_pdf_review.sql`

---

## API routes (Phase 1)

Base: `/api/v1/dpr-pdf-review`

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/proposals/:id/review?documentId=` | `dpr_pdf_review:read` | Get or create review session |
| GET | `/proposals/:id/pdf-stream?documentId=` | `dpr_pdf_review:read` | Stream PDF (reuse stored file) |
| GET | `/proposals/:id/annotations?documentId=` | `dpr_pdf_review:read` | List annotations |
| POST | `/proposals/:id/annotations` | `dpr_pdf_review:annotate` | Create annotation |
| PATCH | `/proposals/:id/annotations/:annotationId` | `dpr_pdf_review:annotate` | Update annotation |
| DELETE | `/proposals/:id/annotations/:annotationId` | `dpr_pdf_review:annotate` | Delete annotation |
| GET | `/proposals/:id/comments?documentId=` | `dpr_pdf_review:read` | List comments |
| POST | `/proposals/:id/comments` | `dpr_pdf_review:comment` | Create comment |
| PATCH | `/proposals/:id/comments/:commentId` | `dpr_pdf_review:comment` | Update own comment |
| DELETE | `/proposals/:id/comments/:commentId` | `dpr_pdf_review:comment` | Delete own comment |
| GET | `/proposals/:id/versions?documentId=` | `dpr_pdf_review:read` | Version history stub |

All routes use `JwtAuthGuard`, `PermissionsGuard`, `DprProposalDivisionGuard`.

---

## Frontend components (Phase 1)

| Component | Path | Purpose |
|-----------|------|---------|
| `DprPdfReviewViewer.tsx` | `components/dpr/` | PDF.js + canvas tools + sidebar |
| API client | `services/api.ts` → `dprPdfReviewApi` | REST wrapper |
| Entry points | `DprTacReviewPanel`, `DprRevisionPanel` | "Review PDF Online" button |

### Integration point

Best entry: **TAC Review (Stage 4)** and **DPR Revision (Stage 5)** where `dpr_complete_pdf` is the primary review artifact. Secondary: Stage 3 HQ monitoring.

---

## Security notes (full spec → future phases)

| Spec area | Phase 1 | Later |
|-----------|---------|-------|
| RBAC | Division guard + permissions | Per-scope reviewer assignment |
| Watermarks | Not implemented | Viewer overlay + export stamp |
| Audit | `AuditService` on CRUD | Full immutable chain |
| Encrypted storage | Local disk (existing) | S3 SSE or disk encryption |

---

## File map (Phase 1 implementation)

```
database/migrations/094_dpr_pdf_review.sql
backend/api/src/modules/dpr-pdf-review/
  dpr-pdf-review.module.ts
  dpr-pdf-review.controller.ts
  dpr-pdf-review.service.ts
  dto/dpr-pdf-review.dto.ts
  entities/dpr-pdf-review.entity.ts
  constants/dpr-pdf-review.constants.ts
frontend/web/src/components/dpr/DprPdfReviewViewer.tsx
frontend/web/src/services/api.ts (dprPdfReviewApi)
```

---

## What's NOT done (Phases 2–5)

- [ ] Correction workflow state machine & assignment
- [ ] Version compare / diff UI
- [ ] AI text/engineering review
- [ ] AI color-coded highlight mode
- [ ] GIS validation overlay
- [ ] Auto verification after resubmit
- [ ] Dashboard stats widget
- [ ] Email/SMS/in-app notifications
- [ ] Watermarks, encrypted object storage
- [ ] Full annotation toolset (circle, strike, arrows, stamps, signatures)
- [ ] Thumbnails, TOC, fullscreen, search (viewer enhancements)
- [ ] Paperless redline outcome export
