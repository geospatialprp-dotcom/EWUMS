-- Proactive consumer notifications (portal inbox + SMS audit)

CREATE TABLE IF NOT EXISTS om_consumer_notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    consumer_id     UUID REFERENCES om_consumers(id) ON DELETE CASCADE,
    event_type      VARCHAR(50) NOT NULL,
    channel         VARCHAR(20) NOT NULL DEFAULT 'portal',
    status          VARCHAR(20) NOT NULL DEFAULT 'sent',
    title           VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}',
    read_at         TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_om_consumer_notif_consumer
    ON om_consumer_notifications(tenant_id, consumer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_om_consumer_notif_unread
    ON om_consumer_notifications(tenant_id, consumer_id)
    WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_om_consumer_notif_event_bill
    ON om_consumer_notifications(tenant_id, event_type, (payload->>'billId'), created_at DESC);
