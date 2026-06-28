-- Contractor construction workflow: DPR, MB, BOQ, invoices (gravity & pumping schemes)

-- Permissions
INSERT INTO permissions (resource, action, description) VALUES
('construction', 'create', 'Create DPR, MB, and invoices'),
('construction', 'read', 'View construction records'),
('construction', 'update', 'Update construction records'),
('construction', 'submit', 'Submit for departmental approval'),
('construction', 'approve', 'Approve or reject construction submissions'),
('construction', 'measure', 'Record measurement book entries (JE)'),
('construction', 'accounts', 'Finalize BOQ and verify invoices')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000001', id, 'organization'
FROM permissions WHERE resource = 'construction';

-- Construction roles
INSERT INTO roles (id, tenant_id, code, name, is_system) VALUES
('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'contractor', 'Contractor', TRUE),
('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'je', 'Junior Engineer (JE)', TRUE),
('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'ae', 'Assistant Engineer (AE)', TRUE),
('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'ee', 'Executive Engineer (EE)', TRUE),
('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'accounts', 'Accounts Officer', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000005', id, 'organization'
FROM permissions WHERE resource IN ('project', 'construction') AND action IN ('read', 'create', 'update', 'submit');

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000006', id, 'organization'
FROM permissions WHERE resource IN ('project', 'construction') AND action IN ('read', 'measure', 'approve', 'submit');

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000007', id, 'organization'
FROM permissions WHERE resource IN ('project', 'construction') AND action IN ('read', 'approve');

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000008', id, 'organization'
FROM permissions WHERE resource IN ('project', 'construction') AND action IN ('read', 'approve');

INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'b0000000-0000-0000-0000-000000000009', id, 'organization'
FROM permissions WHERE resource IN ('project', 'construction', 'report') AND action IN ('read', 'accounts', 'approve', 'export');

-- Demo users for construction chain
INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, department, status) VALUES
('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'contractor@egip.local',
 crypt('Contractor@123', gen_salt('bf')), 'Build', 'Contractor', 'Contractor Firm', 'active'),
('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'je@egip.local',
 crypt('JE@123', gen_salt('bf')), 'Junior', 'Engineer', 'Field Engineering', 'active'),
('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'ae@egip.local',
 crypt('AE@123', gen_salt('bf')), 'Assistant', 'Engineer', 'Division Office', 'active'),
('c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'ee@egip.local',
 crypt('EE@123', gen_salt('bf')), 'Executive', 'Engineer', 'Chief Engineer Office', 'active'),
('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'accounts@egip.local',
 crypt('Accounts@123', gen_salt('bf')), 'Finance', 'Accounts', 'Accounts Branch', 'active');

INSERT INTO user_roles (user_id, role_id) VALUES
('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005'),
('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000006'),
('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000007'),
('c0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000008'),
('c0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000009');

-- BOQ master items per project (gravity & pumping schemes)
CREATE TABLE IF NOT EXISTS boq_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    scheme_type     VARCHAR(20) NOT NULL CHECK (scheme_type IN ('gravity', 'pumping')),
    item_code       VARCHAR(50) NOT NULL,
    description     TEXT NOT NULL,
    unit            VARCHAR(30) NOT NULL,
    contract_qty    DECIMAL(14,3) DEFAULT 0,
    rate            DECIMAL(14,2) DEFAULT 0,
    sort_order      INT DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, item_code)
);

CREATE INDEX IF NOT EXISTS idx_boq_items_project ON boq_items(project_id, scheme_type);

-- Daily Progress Reports (DPR)
CREATE TABLE IF NOT EXISTS dpr_reports (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    dpr_number          VARCHAR(50) NOT NULL,
    report_date         DATE NOT NULL,
    scheme_type         VARCHAR(20) NOT NULL CHECK (scheme_type IN ('gravity', 'pumping')),
    work_location       VARCHAR(500),
    weather             VARCHAR(100),
    manpower_count      INT DEFAULT 0,
    remarks             TEXT,
    status              VARCHAR(50) DEFAULT 'draft',
    workflow_instance_id UUID REFERENCES workflow_instances(id),
    submitted_by        UUID REFERENCES users(id),
    submitted_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, dpr_number)
);

CREATE INDEX IF NOT EXISTS idx_dpr_reports_project ON dpr_reports(project_id, report_date DESC);

CREATE TABLE IF NOT EXISTS dpr_activities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dpr_id          UUID NOT NULL REFERENCES dpr_reports(id) ON DELETE CASCADE,
    activity_code   VARCHAR(50),
    description     TEXT NOT NULL,
    unit            VARCHAR(30) NOT NULL,
    quantity_done   DECIMAL(14,3) DEFAULT 0,
    boq_item_id     UUID REFERENCES boq_items(id),
    location_detail VARCHAR(500),
    sort_order      INT DEFAULT 0
);

-- Support documents (DPR / MB / Invoice)
CREATE TABLE IF NOT EXISTS construction_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    resource_type   VARCHAR(30) NOT NULL CHECK (resource_type IN ('dpr', 'measurement_book', 'invoice')),
    resource_id     UUID NOT NULL,
    doc_type        VARCHAR(50) NOT NULL,
    file_name       VARCHAR(500) NOT NULL,
    file_url        TEXT NOT NULL,
    uploaded_by     UUID REFERENCES users(id),
    uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_construction_docs_resource ON construction_documents(resource_type, resource_id);

-- Measurement Book (MB)
CREATE TABLE IF NOT EXISTS measurement_books (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    dpr_id              UUID REFERENCES dpr_reports(id),
    mb_number           VARCHAR(50) NOT NULL,
    scheme_type         VARCHAR(20) NOT NULL CHECK (scheme_type IN ('gravity', 'pumping')),
    measurement_date    DATE NOT NULL,
    site_location       VARCHAR(500),
    status              VARCHAR(50) DEFAULT 'draft',
    je_measured_by      UUID REFERENCES users(id),
    je_measured_at      TIMESTAMPTZ,
    ae_checked_by       UUID REFERENCES users(id),
    ae_checked_at       TIMESTAMPTZ,
    ee_checked_by       UUID REFERENCES users(id),
    ee_checked_at       TIMESTAMPTZ,
    accounts_finalized_by UUID REFERENCES users(id),
    accounts_finalized_at TIMESTAMPTZ,
    workflow_instance_id UUID REFERENCES workflow_instances(id),
    remarks             TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, mb_number)
);

CREATE TABLE IF NOT EXISTS mb_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mb_id           UUID NOT NULL REFERENCES measurement_books(id) ON DELETE CASCADE,
    boq_item_id     UUID REFERENCES boq_items(id),
    item_code       VARCHAR(50),
    description     TEXT NOT NULL,
    unit            VARCHAR(30) NOT NULL,
    measured_qty    DECIMAL(14,3) NOT NULL DEFAULT 0,
    rate            DECIMAL(14,2) DEFAULT 0,
    amount          DECIMAL(14,2) GENERATED ALWAYS AS (measured_qty * rate) STORED,
    length_m        DECIMAL(14,3),
    width_m         DECIMAL(14,3),
    height_m        DECIMAL(14,3),
    nos             DECIMAL(14,3),
    sort_order      INT DEFAULT 0
);

-- Contractor invoices
CREATE TABLE IF NOT EXISTS contractor_invoices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    invoice_number      VARCHAR(50) NOT NULL,
    billing_period_from DATE,
    billing_period_to   DATE,
    scheme_type         VARCHAR(20) CHECK (scheme_type IN ('gravity', 'pumping', 'both')),
    status              VARCHAR(50) DEFAULT 'draft',
    gross_amount        DECIMAL(14,2) DEFAULT 0,
    deductions          DECIMAL(14,2) DEFAULT 0,
    net_amount          DECIMAL(14,2) DEFAULT 0,
    workflow_instance_id UUID REFERENCES workflow_instances(id),
    submitted_by        UUID REFERENCES users(id),
    submitted_at        TIMESTAMPTZ,
    department_ref      VARCHAR(100),
    remarks             TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id      UUID NOT NULL REFERENCES contractor_invoices(id) ON DELETE CASCADE,
    boq_item_id     UUID REFERENCES boq_items(id),
    mb_entry_id     UUID REFERENCES mb_entries(id),
    description     TEXT NOT NULL,
    unit            VARCHAR(30) NOT NULL,
    quantity        DECIMAL(14,3) NOT NULL DEFAULT 0,
    rate            DECIMAL(14,2) DEFAULT 0,
    amount          DECIMAL(14,2) GENERATED ALWAYS AS (quantity * rate) STORED,
    sort_order      INT DEFAULT 0
);

-- Workflow definitions for construction
INSERT INTO workflow_definitions (id, tenant_id, code, name, resource_type, description, steps) VALUES
('f1000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
 'dpr_submit', 'DPR Approval', 'dpr',
 'Contractor DPR: JE review → AE review → EE approval with support documents.',
 '[{"order":1,"name":"JE Review","role":"je","action":"review"},{"order":2,"name":"AE Review","role":"ae","action":"review"},{"order":3,"name":"EE Approval","role":"ee","action":"approve"}]'),
('f1000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001',
 'mb_submit', 'Measurement Book Approval', 'measurement_book',
 'MB measured by JE → checked by AE → checked by EE → BOQ finalized by Accounts.',
 '[{"order":1,"name":"JE Measurement","role":"je","action":"measure"},{"order":2,"name":"AE Check","role":"ae","action":"check"},{"order":3,"name":"EE Check","role":"ee","action":"check"},{"order":4,"name":"Accounts BOQ Finalization","role":"accounts","action":"finalize"}]'),
('f1000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001',
 'invoice_submit', 'Contractor Invoice to Department', 'invoice',
 'Contractor invoice → Accounts verification → EE sanction for payment.',
 '[{"order":1,"name":"Accounts Verification","role":"accounts","action":"verify"},{"order":2,"name":"EE Sanction","role":"ee","action":"approve"}]')
ON CONFLICT (tenant_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  steps = EXCLUDED.steps;

-- Sample BOQ for demo project (gravity + pumping)
INSERT INTO boq_items (tenant_id, project_id, scheme_type, item_code, description, unit, contract_qty, rate, sort_order) VALUES
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity',
 'GR-01', 'Excavation for pipeline trench in ordinary soil', 'cum', 500, 450.00, 1),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity',
 'GR-02', 'Laying DI pipeline 100 mm dia', 'rm', 1200, 850.00, 2),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity',
 'GR-03', 'Gate valve 100 mm installation', 'nos', 25, 12500.00, 3),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'pumping',
 'PM-01', 'Pump house civil works', 'sqm', 120, 3200.00, 1),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'pumping',
 'PM-02', 'Submersible pump set 50 HP supply & install', 'nos', 2, 285000.00, 2),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'pumping',
 'PM-03', 'Rising main MS pipeline 150 mm dia', 'rm', 800, 1200.00, 3)
ON CONFLICT (project_id, item_code) DO NOTHING;
