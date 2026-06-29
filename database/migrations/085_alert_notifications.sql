-- Staff / system alert notification audit log (email, SMS, WhatsApp)
-- Renumbered from 060_alert_notifications.sql (060 conflict with dpr_approval_workflow)

CREATE TABLE IF NOT EXISTS om_alert_notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type      VARCHAR(50) NOT NULL,
    channel         VARCHAR(20) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'sent',
    recipient       VARCHAR(255),
    subject         VARCHAR(255),
    message         TEXT NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}',
    provider        VARCHAR(50),
    error_reason    TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_om_alert_notif_tenant_created
    ON om_alert_notifications(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_om_alert_notif_event
    ON om_alert_notifications(tenant_id, event_type, created_at DESC);
