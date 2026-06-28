-- Stage 15: Billing, Revenue & Financial Management

CREATE TABLE IF NOT EXISTS om_billing_tariffs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
    tariff_code         VARCHAR(50) NOT NULL,
    tariff_name         VARCHAR(255) NOT NULL,
    consumer_category   VARCHAR(30),
    billing_cycle       VARCHAR(20) DEFAULT 'monthly',
    fixed_charge        NUMERIC(10, 2) DEFAULT 0,
    service_charge      NUMERIC(10, 2) DEFAULT 0,
    maintenance_charge  NUMERIC(10, 2) DEFAULT 0,
    meter_rent          NUMERIC(10, 2) DEFAULT 0,
    late_penalty_pct    NUMERIC(5, 2) DEFAULT 2,
    reconnection_charge NUMERIC(10, 2) DEFAULT 0,
    new_connection_charge NUMERIC(10, 2) DEFAULT 0,
    tax_pct             NUMERIC(5, 2) DEFAULT 0,
    slabs               JSONB NOT NULL DEFAULT '[]',
    effective_from      DATE NOT NULL,
    effective_to        DATE,
    status              VARCHAR(30) DEFAULT 'active',
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_om_billing_tariff_code ON om_billing_tariffs(tenant_id, tariff_code);
CREATE INDEX IF NOT EXISTS idx_om_billing_tariffs_project ON om_billing_tariffs(tenant_id, project_id);

CREATE TABLE IF NOT EXISTS om_meter_readings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    consumer_id         UUID NOT NULL REFERENCES om_consumers(id) ON DELETE CASCADE,
    reading_date        DATE NOT NULL,
    reading_method      VARCHAR(30) DEFAULT 'manual',
    previous_reading    NUMERIC(12, 3),
    current_reading     NUMERIC(12, 3) NOT NULL,
    consumption_kl      NUMERIC(12, 3),
    latitude            DOUBLE PRECISION,
    longitude           DOUBLE PRECISION,
    meter_condition     VARCHAR(30) DEFAULT 'normal',
    photo_url           TEXT,
    validation_flags    JSONB DEFAULT '{}',
    is_abnormal         BOOLEAN DEFAULT FALSE,
    notes               TEXT,
    recorded_by         UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_om_meter_readings_unique ON om_meter_readings(consumer_id, reading_date);
CREATE INDEX IF NOT EXISTS idx_om_meter_readings_tenant ON om_meter_readings(tenant_id, reading_date DESC);

CREATE TABLE IF NOT EXISTS om_consumer_bills (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
    consumer_id         UUID NOT NULL REFERENCES om_consumers(id),
    tariff_id           UUID REFERENCES om_billing_tariffs(id) ON DELETE SET NULL,
    meter_reading_id    UUID REFERENCES om_meter_readings(id) ON DELETE SET NULL,
    bill_no             VARCHAR(50) NOT NULL,
    billing_period_from DATE NOT NULL,
    billing_period_to   DATE NOT NULL,
    previous_reading    NUMERIC(12, 3),
    current_reading     NUMERIC(12, 3),
    consumption_kl      NUMERIC(12, 3) NOT NULL DEFAULT 0,
    water_charge        NUMERIC(12, 2) DEFAULT 0,
    fixed_charge        NUMERIC(10, 2) DEFAULT 0,
    service_charge      NUMERIC(10, 2) DEFAULT 0,
    maintenance_charge  NUMERIC(10, 2) DEFAULT 0,
    meter_rent          NUMERIC(10, 2) DEFAULT 0,
    tax_amount          NUMERIC(10, 2) DEFAULT 0,
    penalty_amount      NUMERIC(10, 2) DEFAULT 0,
    arrears_amount      NUMERIC(12, 2) DEFAULT 0,
    total_amount        NUMERIC(12, 2) NOT NULL,
    amount_paid         NUMERIC(12, 2) DEFAULT 0,
    balance_amount      NUMERIC(12, 2) DEFAULT 0,
    status              VARCHAR(30) DEFAULT 'generated',
    due_date            DATE,
    issued_at           TIMESTAMPTZ,
    paid_at             TIMESTAMPTZ,
    details             JSONB DEFAULT '{}',
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_om_consumer_bill_no ON om_consumer_bills(tenant_id, bill_no);
CREATE INDEX IF NOT EXISTS idx_om_consumer_bills_consumer ON om_consumer_bills(tenant_id, consumer_id, billing_period_from DESC);
CREATE INDEX IF NOT EXISTS idx_om_consumer_bills_status ON om_consumer_bills(tenant_id, status);

CREATE TABLE IF NOT EXISTS om_billing_payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    consumer_id         UUID NOT NULL REFERENCES om_consumers(id),
    bill_id             UUID REFERENCES om_consumer_bills(id) ON DELETE SET NULL,
    receipt_no          VARCHAR(50) NOT NULL,
    payment_date        DATE NOT NULL,
    payment_mode        VARCHAR(30) NOT NULL,
    amount              NUMERIC(12, 2) NOT NULL,
    transaction_ref     VARCHAR(100),
    notes               TEXT,
    collected_by        UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_om_billing_receipt_no ON om_billing_payments(tenant_id, receipt_no);
CREATE INDEX IF NOT EXISTS idx_om_billing_payments_bill ON om_billing_payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_om_billing_payments_consumer ON om_billing_payments(tenant_id, consumer_id, payment_date DESC);

ALTER TABLE om_consumers ADD COLUMN IF NOT EXISTS ward VARCHAR(100);
ALTER TABLE om_consumers ADD COLUMN IF NOT EXISTS consumer_category VARCHAR(30);
ALTER TABLE om_consumers ADD COLUMN IF NOT EXISTS aadhaar_last4 VARCHAR(4);
ALTER TABLE om_consumers ADD COLUMN IF NOT EXISTS tariff_id UUID REFERENCES om_billing_tariffs(id) ON DELETE SET NULL;
