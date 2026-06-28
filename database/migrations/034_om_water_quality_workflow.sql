-- Stage 6: Water quality monitoring workflow extensions

ALTER TABLE om_water_quality_tests
    ADD COLUMN IF NOT EXISTS sample_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS lab_tested_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS result_uploaded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS gis_mapped_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS non_compliance_details JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_om_wq_sample_code
    ON om_water_quality_tests(tenant_id, sample_code)
    WHERE sample_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_om_wq_compliance ON om_water_quality_tests(tenant_id, is_compliant);
