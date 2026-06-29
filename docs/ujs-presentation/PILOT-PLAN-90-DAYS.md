# 90-Day Pilot Plan — EWUMS for Uttarakhand Jal Sansthan

**Document type:** Formal pilot proposal (print-ready)  
**Submitted by:** PRP Geospatial Solutions  
**Platform:** EWUMS — Enterprises Water Utility Management System  
**URL:** https://ewumsujs.com  
**Date:** June 2026  
**Version:** 1.0

---

## 1. Executive Summary

Uttarakhand Jal Sansthan (UJS) proposes a **90-day controlled pilot** of the EWUMS platform in **Dehradun North Division (DIV-DNN)** under Garhwal Circle. The pilot will digitise end-to-end scheme management — from DPR tracking through construction measurement, contractor payments, GIS asset registry, O&M handover, and consumer billing — for one to two live schemes.

PRP Geospatial Solutions will implement, train, and support the pilot. Success will be measured against defined KPIs and reviewed by a joint UJS–PRP steering committee. Upon successful completion, rollout will extend to remaining Dehradun sub-divisions (Raipur, South, Pithuwala, Rural) and Haridwar divisions.

---

## 2. Objectives

| # | Objective | Success Indicator |
|---|-----------|-------------------|
| O1 | Establish division-scoped digital workspace for Dehradun North | 100% pilot schemes created in EWUMS |
| O2 | Digitise construction workflow (DPR → MB → RA Bill) | ≥2 RA bill cycles completed digitally |
| O3 | Register scheme assets on GIS map with attributes | ≥80% commissioned assets mapped |
| O4 | Enable executive visibility via Command Center dashboard | Weekly EE/SE dashboard review |
| O5 | Train division staff on core modules | ≥15 users certified on platform |
| O6 | Validate audit trail and RBAC for government compliance | Zero unauthorised cross-division access in audit test |

---

## 3. Scope

### 3.1 In Scope

- **Organisation unit:** Dehradun North Division (code: `DIV-DNN`, district: Dehradun, circle: Garhwal)
- **Schemes:** 1–2 active water supply schemes (pilot: *Clement Town Water Supply Scheme* or UJS-nominated schemes)
- **Modules (live):**
  - DPR & Planning Management
  - Construction Management (dashboard, progress, milestones)
  - MB Management, BOQ Reconciliation
  - RA Bill & Final Bill workflows
  - GIS Asset Management (Map Explorer)
  - O&M Management (handover, PM, breakdown)
  - Billing & Revenue (if scheme commissioned)
  - Executive Dashboard
  - Audit Trail & Workflow Inbox
  - User Management & Division RBAC

### 3.2 Out of Scope (Pilot Phase)

- Statewide rollout to all 30+ divisions
- Live ERP/ treasury integration (manual export acceptable)
- Physical SCADA hardware installation
- Custom mobile app store deployment (web mobile billing only)
- Legacy data migration beyond pilot schemes

### 3.3 Reference Divisions (Future Phases)

From Migration 084 — Garhwal Circle field offices:

| Code | Division Name | District |
|------|---------------|----------|
| DIV-DNN | Dehradun North Division | Dehradun |
| DIV-DRP | Dehradun Raipur Division | Dehradun |
| DIV-DNS | Dehradun South Division | Dehradun |
| DIV-DPW | Dehradun Pithuwala Division | Dehradun |
| DIV-DRL | Dehradun Rural Division | Dehradun |
| DIV-HRR | Haridwar Rural Division | Haridwar |

---

## 4. Timeline — Week by Week

### Phase A: Mobilisation (Weeks 1–2)

| Week | Activities | Deliverables |
|------|------------|--------------|
| **W1** | Steering committee formation; pilot MoU/approval; nominate UJS pilot team | Signed pilot charter; team list |
| **W1** | PRP: configure DIV-DNN users, roles, division assignments on ewumsujs.com | User accounts live |
| **W2** | Data workshop: scheme details, BOQ, existing MB/RA records | Data collection template completed |
| **W2** | PRP: import pilot scheme(s), BOQ, milestones | Scheme visible in Projects module |

### Phase B: Construction Digitisation (Weeks 3–6)

| Week | Activities | Deliverables |
|------|------------|--------------|
| **W3** | Training Batch 1: EE, AE, JE — Construction & MB (4 hrs) | Training attendance sheet |
| **W3–W4** | JE enters historical MB data; contractor submits DPR activities | MB records in system |
| **W4** | Training Batch 2: Accounts — BOQ, RA Bill workflow (3 hrs) | Accounts user active |
| **W5** | First RA Bill generated and routed (JE → AE → EE → Finance) | RA Bill #1 approved |
| **W6** | GIS: digitise pipeline, reservoir, valve assets on map | GIS layer published |

### Phase C: O&M & Revenue (Weeks 7–9)

| Week | Activities | Deliverables |
|------|------------|--------------|
| **W7** | O&M handover documentation (if scheme stage permits) | Handover record |
| **W7–W8** | Consumer registry + sample billing cycle | ≥50 consumer records |
| **W8** | Training Batch 3: O&M operators, billing officers (3 hrs) | O&M users active |
| **W9** | Executive dashboard review #1 with SE Garhwal | Meeting minutes |

### Phase D: Evaluation & Scale Decision (Weeks 10–13)

| Week | Activities | Deliverables |
|------|------------|--------------|
| **W10** | RBAC audit test — cross-division access verification | Audit test report |
| **W11** | KPI measurement against §6 metrics | Pilot KPI scorecard |
| **W12** | User feedback survey; issue closure | Feedback summary |
| **W13** | Final presentation to UJS leadership; scale-up recommendation | Pilot completion report |

*Note: Week numbers assume pilot start within 5 working days of approval.*

---

## 5. Deliverables

| # | Deliverable | Owner | Due |
|---|-------------|-------|-----|
| D1 | Pilot configuration on ewumsujs.com (DIV-DNN) | PRP Geospatial | Week 2 |
| D2 | User accounts and RBAC matrix | PRP + UJS IT | Week 2 |
| D3 | Pilot scheme(s) loaded with BOQ and milestones | PRP | Week 2 |
| D4 | Training materials (Hindi/English quick guides) | PRP | Week 3 |
| D5 | ≥3 training sessions completed | PRP + UJS EE | Week 8 |
| D6 | ≥2 digital RA bill cycles | UJS Accounts + PRP support | Week 6 |
| D7 | GIS asset layer for pilot scheme | UJS GIS + PRP | Week 6 |
| D8 | Executive dashboard weekly snapshots | UJS EE | Weeks 5–12 |
| D9 | Pilot KPI scorecard | PRP | Week 11 |
| D10 | Scale-up proposal (Garhwal Circle Phase 2) | PRP | Week 13 |

---

## 6. Success Metrics

| Metric | Baseline (Manual) | Pilot Target | Measurement |
|--------|-------------------|--------------|-------------|
| Scheme data digitisation | 0% in EWUMS | 100% pilot schemes | Project records count |
| RA bill cycle time | ~21 days (est.) | ≤14 days | Workflow timestamps |
| MB entry lag | 7–14 days | ≤3 days | MB created_at vs field date |
| GIS asset coverage | Partial paper maps | ≥80% assets on map | Asset count vs BOQ |
| User adoption | N/A | ≥15 active users | Login analytics |
| Dashboard usage | N/A | Weekly EE review | Meeting minutes |
| Audit compliance | Manual files | 100% workflow logged | Audit log sample |
| Training completion | N/A | ≥90% nominated staff | Attendance sheets |

---

## 7. Team Roles & Responsibilities

### 7.1 UJS — Pilot Team

| Role | Responsibility |
|------|----------------|
| **Pilot Sponsor (CE/CGM)** | Approve pilot, remove blockers, chair steering committee |
| **Pilot Lead (SE Garhwal)** | Fortnightly review, division coordination |
| **Division EE (Dehradun North)** | Day-to-day pilot ownership, data quality |
| **JE (×2)** | MB entry, DPR, field data |
| **AE** | Verification and workflow approvals |
| **Accounts Officer** | RA bills, BOQ reconciliation |
| **GIS Operator** | Map layers, asset digitisation |
| **UJS IT Nodal** | User access, browser connectivity, security clearance |

### 7.2 PRP Geospatial Solutions

| Role | Responsibility |
|------|----------------|
| **Project Manager** | Timeline, deliverables, steering committee |
| **Implementation Engineer** | Configuration, data import, migrations |
| **GIS Specialist** | Map setup, coordinate validation, layer publishing |
| **Training Lead** | Sessions, materials, user support |
| **Support Desk** | Issue triage, bug fixes, ewumsujs.com uptime |

### 7.3 Steering Committee

- **Chair:** UJS CE or designated SE  
- **Members:** EE Dehradun North, UJS IT, Finance representative, PRP Project Manager  
- **Cadence:** Fortnightly (6 meetings during pilot)

---

## 8. Training Plan

| Batch | Audience | Duration | Topics |
|-------|----------|----------|--------|
| 1 | EE, AE, JE | 4 hours | Login, division scope, Projects, Construction, MB, Workflow inbox |
| 2 | Accounts, Contractor liaison | 3 hours | BOQ, RA Bill, reconciliation, approvals |
| 3 | O&M, Billing, GIS | 3 hours | Map Explorer, asset registry, O&M stages, billing |
| 4 | Leadership (optional) | 1 hour | Executive Dashboard, platform modules overview |

**Format:** Hands-on at division office or UJS HQ with live ewumsujs.com environment. Hindi/English mixed delivery.

**Materials:** Quick reference cards, demo credentials sheet, recorded walkthrough (optional).

---

## 9. Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Slow legacy data availability | Medium | High | Start with demo scheme; parallel paper digitisation |
| Low user adoption | Medium | High | Mandatory workflow for RA bills in pilot; EE enforcement |
| Internet connectivity at field offices | Medium | Medium | HQ-based entry initially; mobile billing offline queue |
| Resistance to change | Medium | Medium | Steering committee visibility; quick wins in Week 5 RA bill |
| Cross-division data leakage concern | Low | High | RBAC audit in Week 10; division-scoped demo |
| Platform bugs | Low | Medium | PRP support SLA; staging environment for fixes |

---

## 10. Scale-Up Phases (Post-Pilot)

### Phase 2 — Garhwal Circle Expansion (Months 4–6)

- Dehradun sub-divisions: Raipur, South, Pithuwala, Rural  
- Haridwar Division and Haridwar Rural (DIV-HRW, DIV-HRR)  
- Circle SE dashboard for Garhwal-wide KPIs  

### Phase 3 — Kumaon Circle (Months 7–12)

- Nainital, Haldwani, Ramnagar, Almora, Bageshwar, etc.  
- Consumer portal statewide rollout  

### Phase 4 — Statewide Integration (Year 2)

- ERP/treasury live posting  
- SCADA telemetry feeds  
- SFC / Jal Jeevan Mission reporting automation  
- Advanced analytics and predictive maintenance  

---

## 11. Budget & Resources (Indicative)

*To be finalised in commercial agreement with UJS.*

| Item | Description |
|------|-------------|
| Platform subscription | EWUMS hosting on ewumsujs.com |
| Implementation | Configuration, data migration, GIS setup |
| Training | 4 batches × division staff |
| Support | 90-day dedicated support channel |

---

## 12. Approval Block

| | Name | Designation | Signature | Date |
|---|------|-------------|-----------|------|
| **UJS Sponsor** | | CE / CGM | | |
| **Pilot Lead** | | SE Garhwal | | |
| **Division EE** | | EE Dehradun North | | |
| **Implementer** | | PRP Geospatial Solutions | | |

---

## 13. Annexures

- **Annex A:** `EXECUTIVE-DASHBOARD-SPEC.md` — dashboard widgets and demo KPIs  
- **Annex B:** `DEMO-DATA-SETUP.md` — technical setup for presentation environment  
- **Annex C:** `PRESENTATION-OUTLINE.md` — department meeting slides  
- **Annex D:** UJS Multi-Division RBAC Framework (`docs/UJS-MULTI-DIVISION-RBAC.md`)

---

**Submitted by:**  
PRP Geospatial Solutions  
Platform: EWUMS/S2T2R · https://ewumsujs.com

*This document is intended for submission to Uttarakhand Jal Sansthan for pilot approval. Print on A4, sign approval block, attach to file note.*
