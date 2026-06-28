-- Stage 15.10: Financial Accounting Integration (ERP GL)

CREATE TABLE IF NOT EXISTS om_chart_of_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    account_code    VARCHAR(20) NOT NULL,
    account_name    VARCHAR(255) NOT NULL,
    account_type    VARCHAR(20) NOT NULL,
    is_cash         BOOLEAN DEFAULT FALSE,
    is_bank         BOOLEAN DEFAULT FALSE,
    is_system       BOOLEAN DEFAULT TRUE,
    status          VARCHAR(20) DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_om_coa_code ON om_chart_of_accounts(tenant_id, account_code);

CREATE TABLE IF NOT EXISTS om_journal_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    entry_no        VARCHAR(50) NOT NULL,
    entry_date      DATE NOT NULL,
    source_type     VARCHAR(30) NOT NULL,
    source_id       UUID,
    source_ref      VARCHAR(100),
    narration       TEXT,
    status          VARCHAR(20) DEFAULT 'posted',
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_om_journal_entries_tenant ON om_journal_entries(tenant_id, entry_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_om_journal_entry_no ON om_journal_entries(tenant_id, entry_no);

CREATE TABLE IF NOT EXISTS om_journal_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    entry_id        UUID NOT NULL REFERENCES om_journal_entries(id) ON DELETE CASCADE,
    account_id      UUID NOT NULL REFERENCES om_chart_of_accounts(id),
    debit           NUMERIC(14, 2) DEFAULT 0,
    credit          NUMERIC(14, 2) DEFAULT 0,
    consumer_id     UUID REFERENCES om_consumers(id) ON DELETE SET NULL,
    project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
    reference       VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_om_journal_lines_entry ON om_journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_om_journal_lines_account ON om_journal_lines(tenant_id, account_id);

CREATE TABLE IF NOT EXISTS om_accounting_postings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    source_type     VARCHAR(30) NOT NULL,
    source_id       UUID NOT NULL,
    source_ref      VARCHAR(100),
    journal_entry_id UUID REFERENCES om_journal_entries(id) ON DELETE SET NULL,
    posting_type    VARCHAR(30) NOT NULL,
    amount          NUMERIC(14, 2) NOT NULL,
    erp_status      VARCHAR(20) DEFAULT 'posted',
    erp_reference   VARCHAR(100),
    details         JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_om_accounting_posting_source
    ON om_accounting_postings(tenant_id, source_type, source_id, posting_type);

-- Default chart of accounts for demo tenant
INSERT INTO om_chart_of_accounts (id, tenant_id, account_code, account_name, account_type, is_cash, is_bank, is_system)
SELECT * FROM (VALUES
    ('d1000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, '1100', 'Demand / Receivable Ledger', 'asset', FALSE, FALSE, TRUE),
    ('d1000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, '1110', 'Cash Ledger', 'asset', TRUE, FALSE, TRUE),
    ('d1000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, '1120', 'Bank Ledger', 'asset', FALSE, TRUE, TRUE),
    ('d1000000-0000-0000-0000-000000000004'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, '4100', 'Water Supply Revenue', 'income', FALSE, FALSE, TRUE),
    ('d1000000-0000-0000-0000-000000000005'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, '5100', 'Billing Adjustments / Write-off', 'expense', FALSE, FALSE, TRUE)
) AS v(id, tenant_id, account_code, account_name, account_type, is_cash, is_bank, is_system)
WHERE NOT EXISTS (
    SELECT 1 FROM om_chart_of_accounts
    WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001' AND account_code = '1100'
);
