-- Ensure consumer portal OTP table and demo login row exist (safe re-run).

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

CREATE INDEX IF NOT EXISTS idx_consumer_otp_lookup
    ON consumer_portal_otp_challenges(tenant_id, fhtc_number, mobile, purpose, created_at DESC);

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
  fhtc_number = EXCLUDED.fhtc_number,
  mobile = EXCLUDED.mobile,
  connection_status = EXCLUDED.connection_status,
  updated_at = NOW();
