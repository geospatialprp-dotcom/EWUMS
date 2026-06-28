-- Jal Mitra Phase 2: OTP verification for consumer portal and chat

CREATE TABLE IF NOT EXISTS consumer_portal_otp_challenges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fhtc_number     VARCHAR(50) NOT NULL,
    mobile          VARCHAR(20) NOT NULL,
    otp_hash        VARCHAR(128) NOT NULL,
    purpose         VARCHAR(30) NOT NULL DEFAULT 'portal_login',
    session_id      UUID REFERENCES jal_mitra_sessions(id) ON DELETE SET NULL,
    attempts        SMALLINT NOT NULL DEFAULT 0,
    expires_at      TIMESTAMPTZ NOT NULL,
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consumer_otp_lookup
    ON consumer_portal_otp_challenges(tenant_id, fhtc_number, mobile, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consumer_otp_session
    ON consumer_portal_otp_challenges(session_id)
    WHERE session_id IS NOT NULL;
