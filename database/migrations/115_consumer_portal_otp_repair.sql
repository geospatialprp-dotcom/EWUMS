-- Consumer portal OTP table (safe repair — no hard FK to jal_mitra)

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
