-- Jal Mitra: multilingual AI consumer support (chat sessions, messages, knowledge base)

CREATE TABLE IF NOT EXISTS jal_mitra_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    om_consumer_id      UUID REFERENCES om_consumers(id) ON DELETE SET NULL,
    channel             VARCHAR(30) NOT NULL DEFAULT 'web_portal',
    language            VARCHAR(10) NOT NULL DEFAULT 'hi',
    status              VARCHAR(20) NOT NULL DEFAULT 'active',
    verification_method VARCHAR(30),
    verified_at         TIMESTAMPTZ,
    mobile              VARCHAR(20),
    fhtc_number         VARCHAR(50),
    consumer_name       VARCHAR(255),
    context             JSONB NOT NULL DEFAULT '{}',
    escalated_to_role   VARCHAR(50),
    escalation_no       VARCHAR(40),
    satisfaction_score  SMALLINT,
    closed_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jal_mitra_sessions_tenant ON jal_mitra_sessions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jal_mitra_sessions_consumer ON jal_mitra_sessions(om_consumer_id);

CREATE TABLE IF NOT EXISTS jal_mitra_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES jal_mitra_sessions(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL,
    content         TEXT NOT NULL,
    language        VARCHAR(10),
    intent          VARCHAR(60),
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jal_mitra_messages_session ON jal_mitra_messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS jal_mitra_knowledge_articles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category        VARCHAR(50) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    content         TEXT NOT NULL,
    language        VARCHAR(10) NOT NULL DEFAULT 'en',
    tags            TEXT[] DEFAULT '{}',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jal_mitra_kb_tenant ON jal_mitra_knowledge_articles(tenant_id, category, language);

-- Seed FAQ / policy snippets (demo tenant)
INSERT INTO jal_mitra_knowledge_articles (tenant_id, category, title, content, language, tags) VALUES
('a0000000-0000-0000-0000-000000000001', 'tariff', 'Domestic tariff slab',
 'Domestic FHTC connections are billed as per approved Uttarakhand Jal Sansthan tariff order. Slab rates apply on monthly consumption (KL).',
 'en', ARRAY['tariff','billing','fhtc']),
('a0000000-0000-0000-0000-000000000001', 'tariff', 'Gharailu dar slab',
 'Gharailu FHTC connection ke liye manjoor UJS tariff ke anusaar bill banta hai. Monthly khapat (KL) par slab rate lagta hai.',
 'hi', ARRAY['tariff','billing','fhtc']),
('a0000000-0000-0000-0000-000000000001', 'supply', 'Supply hours',
 'Gravity schemes typically supply water morning 6–9 AM and evening 5–8 PM. Pumping schemes may run on scheduled slots notified by the division.',
 'en', ARRAY['supply','timing']),
('a0000000-0000-0000-0000-000000000001', 'supply', 'Paani supply samay',
 'Gravity yojna mein aam taur par subah 6–9 baje aur shaam 5–8 baje paani milta hai. Pumping yojna ke liye division dwara ghoshit samay follow karein.',
 'hi', ARRAY['supply','timing']),
('a0000000-0000-0000-0000-000000000001', 'connection', 'New FHTC connection',
 'Apply online with village, ward, and identity details. Field verification is done by JE/AE. Approval SMS is sent on sanction.',
 'en', ARRAY['connection','fhtc','application']),
('a0000000-0000-0000-0000-000000000001', 'connection', 'Naya connection',
 'Online aavedan karein — gaon, ward aur pehchan vivaran ke saath. JE/AE field verification karte hain. Manjuri par SMS bheja jata hai.',
 'hi', ARRAY['connection','fhtc','application']);
