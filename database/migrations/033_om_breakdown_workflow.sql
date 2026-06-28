-- Stage 5: Breakdown maintenance workflow extensions

ALTER TABLE om_breakdown_tickets
    ADD COLUMN IF NOT EXISTS category_group VARCHAR(50),
    ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS inspected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS repaired_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS before_photos JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS after_photos JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_om_breakdown_group ON om_breakdown_tickets(tenant_id, category_group);
