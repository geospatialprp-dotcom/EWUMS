-- End-to-End Water Supply Construction Workflow (Gravity & Pumping)
-- Stages: Planning → DPR → MB → Verification → BOQ Reconciliation → RA Bills → Final → GIS

-- ── Extend BOQ with project component & revised quantities ──
ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS component VARCHAR(50);
ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS revised_qty DECIMAL(14,3) DEFAULT 0;
ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS dpr_qty DECIMAL(14,3) DEFAULT 0;

UPDATE boq_items SET component = 'gravity_main' WHERE scheme_type = 'gravity' AND component IS NULL;
UPDATE boq_items SET component = 'pumping_main' WHERE scheme_type = 'pumping' AND component IS NULL;
UPDATE boq_items SET revised_qty = contract_qty WHERE revised_qty = 0 OR revised_qty IS NULL;

-- ── Work packages (Stage 1) ──
CREATE TABLE IF NOT EXISTS work_packages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    package_code        VARCHAR(50) NOT NULL,
    name                VARCHAR(255) NOT NULL,
    component           VARCHAR(50) NOT NULL,
    scheme_type         VARCHAR(20) CHECK (scheme_type IN ('gravity', 'pumping', 'both')),
    contractor_name     VARCHAR(255),
    contractor_id       UUID REFERENCES users(id),
    chainage_from       VARCHAR(50),
    chainage_to         VARCHAR(50),
    status              VARCHAR(50) DEFAULT 'planned',
    gis_alignment_status VARCHAR(50) DEFAULT 'pending',
    remarks             TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, package_code)
);

CREATE INDEX IF NOT EXISTS idx_work_packages_project ON work_packages(project_id, component);

-- ── Work planning records (Stage 1 approvals & uploads) ──
CREATE TABLE IF NOT EXISTS work_planning (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    approved_dpr_url        TEXT,
    admin_approval_ref      VARCHAR(100),
    technical_sanction_ref  VARCHAR(100),
    boq_upload_url          TEXT,
    drawing_upload_url      TEXT,
    gis_alignment_approved  BOOLEAN DEFAULT FALSE,
    status                  VARCHAR(50) DEFAULT 'draft',
    approved_by             UUID REFERENCES users(id),
    approved_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id)
);

-- ── Extend DPR for daily field activity ──
ALTER TABLE dpr_reports ADD COLUMN IF NOT EXISTS work_package_id UUID REFERENCES work_packages(id);
ALTER TABLE dpr_reports ADD COLUMN IF NOT EXISTS contractor_name VARCHAR(255);
ALTER TABLE dpr_reports ADD COLUMN IF NOT EXISTS supervisor_name VARCHAR(255);

ALTER TABLE dpr_activities ADD COLUMN IF NOT EXISTS component VARCHAR(50);
ALTER TABLE dpr_activities ADD COLUMN IF NOT EXISTS chainage_from VARCHAR(50);
ALTER TABLE dpr_activities ADD COLUMN IF NOT EXISTS chainage_to VARCHAR(50);
ALTER TABLE dpr_activities ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7);
ALTER TABLE dpr_activities ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7);
ALTER TABLE dpr_activities ADD COLUMN IF NOT EXISTS material_consumption TEXT;
ALTER TABLE dpr_activities ADD COLUMN IF NOT EXISTS labour_count INT DEFAULT 0;
ALTER TABLE dpr_activities ADD COLUMN IF NOT EXISTS equipment_details TEXT;

-- ── Extend MB for JE measurement ──
ALTER TABLE measurement_books ADD COLUMN IF NOT EXISTS work_package_id UUID REFERENCES work_packages(id);

ALTER TABLE mb_entries ADD COLUMN IF NOT EXISTS chainage_from VARCHAR(50);
ALTER TABLE mb_entries ADD COLUMN IF NOT EXISTS chainage_to VARCHAR(50);
ALTER TABLE mb_entries ADD COLUMN IF NOT EXISTS depth_m DECIMAL(14,3);
ALTER TABLE mb_entries ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7);
ALTER TABLE mb_entries ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7);

-- ── Running Account (RA) Bills (Stage 6) ──
CREATE TABLE IF NOT EXISTS ra_bills (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    ra_number           VARCHAR(50) NOT NULL,
    ra_sequence         INT DEFAULT 1,
    billing_period_from DATE,
    billing_period_to   DATE,
    scheme_type         VARCHAR(20),
    status              VARCHAR(50) DEFAULT 'draft',
    gross_amount        DECIMAL(14,2) DEFAULT 0,
    previous_amount     DECIMAL(14,2) DEFAULT 0,
    recoveries          DECIMAL(14,2) DEFAULT 0,
    gst_amount          DECIMAL(14,2) DEFAULT 0,
    net_payable         DECIMAL(14,2) DEFAULT 0,
    workflow_instance_id UUID REFERENCES workflow_instances(id),
    submitted_by        UUID REFERENCES users(id),
    submitted_at        TIMESTAMPTZ,
    remarks             TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, ra_number)
);

CREATE TABLE IF NOT EXISTS ra_bill_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ra_bill_id      UUID NOT NULL REFERENCES ra_bills(id) ON DELETE CASCADE,
    boq_item_id     UUID REFERENCES boq_items(id),
    mb_entry_id     UUID REFERENCES mb_entries(id),
    description     TEXT NOT NULL,
    unit            VARCHAR(30) NOT NULL,
    boq_rate        DECIMAL(14,2) DEFAULT 0,
    previous_qty    DECIMAL(14,3) DEFAULT 0,
    current_qty     DECIMAL(14,3) DEFAULT 0,
    total_qty       DECIMAL(14,3) DEFAULT 0,
    amount          DECIMAL(14,2) GENERATED ALWAYS AS (total_qty * boq_rate) STORED,
    sort_order      INT DEFAULT 0
);

-- ── Extend invoices for RA / Final bill types ──
ALTER TABLE contractor_invoices ADD COLUMN IF NOT EXISTS bill_type VARCHAR(20) DEFAULT 'ra';
ALTER TABLE contractor_invoices ADD COLUMN IF NOT EXISTS gst_amount DECIMAL(14,2) DEFAULT 0;
ALTER TABLE contractor_invoices ADD COLUMN IF NOT EXISTS previous_amount DECIMAL(14,2) DEFAULT 0;
ALTER TABLE contractor_invoices ADD COLUMN IF NOT EXISTS ra_bill_id UUID REFERENCES ra_bills(id);

ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS previous_qty DECIMAL(14,3) DEFAULT 0;
ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS current_qty DECIMAL(14,3) DEFAULT 0;

-- ── GIS construction assets (Stage 8) ──
CREATE TABLE IF NOT EXISTS construction_assets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    asset_code          VARCHAR(50) NOT NULL,
    asset_type          VARCHAR(50) NOT NULL,
    component           VARCHAR(50),
    name                VARCHAR(255),
    latitude            DECIMAL(10,7),
    longitude           DECIMAL(10,7),
    chainage            VARCHAR(50),
    installation_date   DATE,
    contractor_name     VARCHAR(255),
    status              VARCHAR(50) DEFAULT 'planned',
    mb_reference        VARCHAR(50),
    photo_url           TEXT,
    attributes          JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, asset_code)
);

CREATE INDEX IF NOT EXISTS idx_construction_assets_project ON construction_assets(project_id, asset_type);

-- ── Project completion & certificates (Stage 7/10) ──
CREATE TABLE IF NOT EXISTS project_completion (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    mb_completion_pct       DECIMAL(5,2) DEFAULT 0,
    fhtc_completion_pct     DECIMAL(5,2) DEFAULT 0,
    gis_mapping_pct         DECIMAL(5,2) DEFAULT 0,
    as_built_verified       BOOLEAN DEFAULT FALSE,
    reservoir_commissioned  BOOLEAN DEFAULT FALSE,
    pumping_commissioned    BOOLEAN DEFAULT FALSE,
    completion_certificate_url TEXT,
    handover_certificate_url   TEXT,
    final_bill_status       VARCHAR(50) DEFAULT 'pending',
    status                  VARCHAR(50) DEFAULT 'in_progress',
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id)
);

-- Expand document resource types
ALTER TABLE construction_documents DROP CONSTRAINT IF EXISTS construction_documents_resource_type_check;
ALTER TABLE construction_documents ADD CONSTRAINT construction_documents_resource_type_check
    CHECK (resource_type IN ('dpr', 'measurement_book', 'invoice', 'ra_bill', 'work_planning', 'completion'));

-- RA Bill workflow: JE → AE → EE → Finance
INSERT INTO workflow_definitions (id, tenant_id, code, name, resource_type, description, steps) VALUES
('f1000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001',
 'ra_bill_submit', 'Running Account Bill Approval', 'ra_bill',
 'RA Bill: JE verify → AE check → EE approve → Finance release.',
 '[{"order":1,"name":"JE Verification","role":"je","action":"verify"},{"order":2,"name":"AE Check","role":"ae","action":"check"},{"order":3,"name":"EE Approval","role":"ee","action":"approve"},{"order":4,"name":"Finance Release","role":"accounts","action":"release"}]')
ON CONFLICT (tenant_id, code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, steps = EXCLUDED.steps;

-- ── Comprehensive BOQ for all 6 project components ──
-- Source Development
INSERT INTO boq_items (tenant_id, project_id, scheme_type, component, item_code, description, unit, contract_qty, revised_qty, rate, sort_order) VALUES
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'source_development', 'SD-01', 'Spring source / river intake development', 'nos', 1, 1, 850000.00, 1),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'source_development', 'SD-02', 'Collection chamber construction', 'nos', 2, 2, 125000.00, 2),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'source_development', 'SD-03', 'Intake structure construction', 'nos', 1, 1, 320000.00, 3),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'source_development', 'SD-04', 'Source protection works (fencing, drainage)', 'rm', 200, 200, 850.00, 4),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'source_development', 'SD-05', 'Water quality testing (lab analysis)', 'nos', 12, 12, 3500.00, 5)
ON CONFLICT (project_id, item_code) DO NOTHING;

-- Gravity Main Pipeline (extended)
INSERT INTO boq_items (tenant_id, project_id, scheme_type, component, item_code, description, unit, contract_qty, revised_qty, rate, sort_order) VALUES
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'gravity_main', 'GR-04', 'Survey and alignment finalization', 'km', 5, 5, 15000.00, 4),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'gravity_main', 'GR-05', 'Pipe transportation and stacking', 'rm', 1200, 1200, 45.00, 5),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'gravity_main', 'GR-06', 'Jointing works (DI / HDPE)', 'joint', 400, 400, 650.00, 6),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'gravity_main', 'GR-07', 'Anchor blocks and thrust blocks', 'nos', 30, 30, 8500.00, 7),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'gravity_main', 'GR-08', 'Air valve and scour valve installation', 'nos', 15, 15, 9800.00, 8),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'gravity_main', 'GR-09', 'Hydrostatic pressure testing', 'km', 5, 5, 22000.00, 9),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'gravity_main', 'GR-10', 'Backfilling and restoration', 'cum', 800, 800, 380.00, 10)
ON CONFLICT (project_id, item_code) DO NOTHING;

-- Pumping Main Pipeline (extended)
INSERT INTO boq_items (tenant_id, project_id, scheme_type, component, item_code, description, unit, contract_qty, revised_qty, rate, sort_order) VALUES
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'pumping', 'pumping_main', 'PM-04', 'Transformer and electrical installation', 'nos', 1, 1, 450000.00, 4),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'pumping', 'pumping_main', 'PM-05', 'Valve chambers construction', 'nos', 8, 8, 42000.00, 5),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'pumping', 'pumping_main', 'PM-06', 'Flow meter installation', 'nos', 2, 2, 65000.00, 6),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'pumping', 'pumping_main', 'PM-07', 'Pressure testing of rising main', 'km', 3, 3, 28000.00, 7),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'pumping', 'pumping_main', 'PM-08', 'Pump commissioning and trial run', 'nos', 2, 2, 35000.00, 8)
ON CONFLICT (project_id, item_code) DO NOTHING;

-- Reservoir Construction
INSERT INTO boq_items (tenant_id, project_id, scheme_type, component, item_code, description, unit, contract_qty, revised_qty, rate, sort_order) VALUES
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'reservoir', 'RS-01', 'GLSR / OHT / CWR construction', 'cum', 500, 500, 4200.00, 1),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'reservoir', 'RS-02', 'Inlet and outlet connections', 'nos', 4, 4, 18500.00, 2),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'reservoir', 'RS-03', 'Overflow and drain arrangements', 'nos', 2, 2, 22000.00, 3),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'reservoir', 'RS-04', 'Water tightness testing', 'nos', 1, 1, 45000.00, 4)
ON CONFLICT (project_id, item_code) DO NOTHING;

-- Distribution Network
INSERT INTO boq_items (tenant_id, project_id, scheme_type, component, item_code, description, unit, contract_qty, revised_qty, rate, sort_order) VALUES
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'distribution', 'DN-01', 'Distribution main laying (100 mm DI)', 'rm', 2500, 2500, 920.00, 1),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'distribution', 'DN-02', 'Sub-main installation (50 mm)', 'rm', 1800, 1800, 680.00, 2),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'distribution', 'DN-03', 'Distribution valve installation', 'nos', 40, 40, 8500.00, 3),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'distribution', 'DN-04', 'Distribution chambers', 'nos', 20, 20, 32000.00, 4),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'distribution', 'DN-05', 'Network testing and chlorination', 'km', 4, 4, 18000.00, 5)
ON CONFLICT (project_id, item_code) DO NOTHING;

-- FHTC
INSERT INTO boq_items (tenant_id, project_id, scheme_type, component, item_code, description, unit, contract_qty, revised_qty, rate, sort_order) VALUES
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'fhtc', 'FH-01', 'Household survey and beneficiary registration', 'nos', 500, 500, 150.00, 1),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'fhtc', 'FH-02', 'Service pipe installation (15 mm HDPE)', 'rm', 8000, 8000, 85.00, 2),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'fhtc', 'FH-03', 'Water meter installation', 'nos', 500, 500, 2200.00, 3),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'fhtc', 'FH-04', 'Tap stand installation', 'nos', 500, 500, 1800.00, 4),
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'gravity', 'fhtc', 'FH-05', 'GPS location capture and beneficiary verification', 'nos', 500, 500, 120.00, 5)
ON CONFLICT (project_id, item_code) DO NOTHING;

-- Demo work packages
-- Demo work packages are created by Administrator in the app (see migration 016)
-- INSERT INTO work_packages ...
ON CONFLICT (project_id, package_code) DO NOTHING;

-- Demo work planning is entered by Administrator in the app (see migration 017)
-- INSERT INTO work_planning ...

-- Demo GIS assets removed — register manually in Stage 8 (see migration 024)
-- INSERT INTO construction_assets (tenant_id, project_id, asset_code, asset_type, component, name, latitude, longitude, chainage, status, contractor_name) VALUES
-- ('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'SRC-001', 'source', 'source_development', 'Spring Intake — Kempty', 30.4578, 78.0654, '0+000', 'completed', 'Build Contractor Pvt Ltd'),
-- ('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'GV-001', 'gate_valve', 'gravity_main', 'Gate Valve 100mm — Ch 0+500', 30.4582, 78.0660, '0+500', 'installed', 'Build Contractor Pvt Ltd'),
-- ('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'AV-001', 'air_valve', 'gravity_main', 'Air Valve — Ch 1+200', 30.4590, 78.0675, '1+200', 'installed', 'Build Contractor Pvt Ltd'),
-- ('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'PH-001', 'pump_house', 'pumping_main', 'Pump House — Site A', 30.4601, 78.0690, 'PH-01', 'planned', 'Build Contractor Pvt Ltd'),
-- ('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'GLSR-001', 'reservoir', 'reservoir', 'GLSR 50 KL — Hilltop', 30.4610, 78.0705, NULL, 'planned', 'Build Contractor Pvt Ltd')
-- ON CONFLICT (project_id, asset_code) DO NOTHING;

-- Demo project completion tracker
INSERT INTO project_completion (tenant_id, project_id, mb_completion_pct, fhtc_completion_pct, gis_mapping_pct, status) VALUES
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 12.5, 0, 8.0, 'in_progress')
ON CONFLICT (project_id) DO NOTHING;
