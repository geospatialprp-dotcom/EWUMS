# Jal Mitra — Multilingual AI Consumer Support Assistant

Architecture and phased delivery for the **Jal Mitra** virtual assistant (Garhwali, Kumaoni, Hindi, English) integrated with EGIP consumer portal, O&M, billing, and complaints.

## Vision

24×7 **text + voice** support for FHTC / water supply consumers across **Web**, **Mobile App**, **WhatsApp**, and **Call Centre**, with automatic complaint registration, billing help, escalation to JE/AE/EE, and division-scoped routing.

## Current implementation (Phase 1 — MVP)

| Capability | Status |
|------------|--------|
| Chat sessions + message history | Done (`jal_mitra_sessions`, `jal_mitra_messages`) |
| Multilingual replies (en/hi/garhwali/kumaoni) | Done (template engine + language detection) |
| Consumer portal chat UI (WhatsApp-style) | Done (`JalMitraChat.tsx`) |
| FHTC + mobile verification in chat | Done |
| Bill lookup, complaint register/status | Done (via existing `ConsumerPortalService`) |
| Quick actions / suggested questions | Done |
| Human escalation reference | Done (`ESC-*` reference) |
| Staff analytics API | Done (`GET /om/jal-mitra/analytics`) |
| Knowledge base table + seed FAQs | Done |
| RAG retrieval over knowledge articles | Done (Phase 2a) |
| OpenAI LLM replies (optional) | Done when `OPENAI_API_KEY` set |
| OTP SMS verification | Done (`CONSUMER_PORTAL_OTP_MODE`) |
| Staff analytics dashboard UI | Done (`/om#jal-mitra`) |
| Proactive notifications (billing + complaints) | Done (Phase 3a) |
| Voice bot / STT / TTS | Phase 3b |

## API endpoints

### Consumer (public / portal JWT)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/consumer-portal/jal-mitra/quick-actions` | Quick reply chips |
| POST | `/consumer-portal/jal-mitra/sessions` | Start chat |
| GET | `/consumer-portal/jal-mitra/sessions/:id/messages` | History |
| POST | `/consumer-portal/jal-mitra/sessions/:id/messages` | Send message |
| POST | `/consumer-portal/jal-mitra/sessions/:id/verify` | FHTC + mobile verify |
| PATCH | `/consumer-portal/jal-mitra/sessions/:id/language` | Switch language |
| POST | `/consumer-portal/auth/otp/request` | Request login OTP |
| POST | `/consumer-portal/auth/otp/verify` | Verify OTP + JWT |
| POST | `/consumer-portal/jal-mitra/sessions/:id/otp/request` | Chat OTP |
| POST | `/consumer-portal/jal-mitra/sessions/:id/otp/verify` | Verify chat OTP |

### Staff

| Method | Path | Description |
|--------|------|-------------|
| GET | `/om/jal-mitra/analytics` | Sessions, languages, intents |

## Integration map

```
Consumer → Jal Mitra Chat → JalMitraService
                ├─ ConsumerPortalService (bills, complaints, profile)
                ├─ OmComplaintService (ticket + division assignment)
                ├─ OmBillingService (arrears, tariffs)
                └─ Knowledge base (FAQ retrieval)
```

## Phase 3 — Proactive notifications (implemented)

- `ConsumerNotificationService` logs portal inbox + SMS via `BillingNotificationService`
- Wired: bill delivery, payment ack, arrear actions, complaint register/status
- `POST /om/notifications/scan-due-bills` — overdue bill reminders (7-day dedupe)
- Consumer portal: `GET /consumer-portal/notifications` + in-app alert banners

## Phase 3b — Voice & WhatsApp

- **Voice:** Twilio / Exotel IVR → speech-to-text → same `JalMitraService.sendMessage` → TTS reply; call transfer to call centre queue; record + transcript in `jal_mitra_voice_calls`.
- **WhatsApp:** Meta Cloud API webhook → session per `wa_id` → outbound templates for bill due / outage alerts.

## Phase 3 — LLM + GIS

- Replace keyword intents with **tool-calling LLM** (OpenAI / Azure / local) grounded on `jal_mitra_knowledge_articles` + vector store.
- **GIS:** consumer lat/lng → nearest pump house / GLSR from `construction_assets` + division outage flags from `om_breakdown_tickets`.

## Database migration

```bash
cd backend/api && node scripts/apply-sql-migrations.js 055
```

## Personality guidelines

- Citizen-centric, simple language, respectful (rural + urban).
- Default Hindi; mirror Garhwali/Kumaoni dialect phrases where configured.
- Always offer escalation if confidence is low or consumer asks for an officer.
