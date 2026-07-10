-- Repair consumer portal OTP (fixes "Internal server error" on Send OTP)
-- Safe even when jal_mitra_sessions is missing.

\echo '==> OTP challenges table (no hard FK to jal_mitra — added later if present)'

CREATE TABLE IF NOT EXISTS consumer_portal_otp_challenges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fhtc_number     VARCHAR(50) NOT NULL,
    mobile          VARCHAR(20) NOT NULL,
    otp_hash        VARCHAR(128) NOT NULL,
    purpose         VARCHAR(30) NOT NULL DEFAULT 'portal_login',
    session_id      UUID,
    attempts        SMALLINT NOT NULL DEFAULT 0,
    expires_at      TIMESTAMPTZ NOT NULL,
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'jal_mitra_sessions'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'consumer_portal_otp_challenges'
      AND constraint_name = 'consumer_portal_otp_challenges_session_id_fkey'
  ) THEN
    ALTER TABLE consumer_portal_otp_challenges
      ADD CONSTRAINT consumer_portal_otp_challenges_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES jal_mitra_sessions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_consumer_otp_lookup
    ON consumer_portal_otp_challenges(tenant_id, fhtc_number, mobile, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consumer_otp_session
    ON consumer_portal_otp_challenges(session_id)
    WHERE session_id IS NOT NULL;

\echo '==> Demo consumer (optional legacy login)'
INSERT INTO om_consumers (
  id, tenant_id, project_id, consumer_code, fhtc_number, consumer_name, mobile,
  village, ward, consumer_category, connection_status, notes
)
VALUES (
  'c1000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001',
  'CON-PORTAL-00001',
  'FHTC-DEMO-001',
  'Demo Household Consumer',
  '9876543210',
  'Tharali',
  'Ward 3',
  'apl',
  'active',
  'Demo account for Online Consumer Portal'
)
ON CONFLICT (id) DO UPDATE SET
  mobile = EXCLUDED.mobile,
  updated_at = NOW();

\echo 'DONE — restart API: docker compose ... restart api'
