-- Stage 7: Energy management extensions

ALTER TABLE om_energy_readings
    ADD COLUMN IF NOT EXISTS reading_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_om_energy_reading_code
    ON om_energy_readings(tenant_id, reading_code)
    WHERE reading_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_om_energy_project ON om_energy_readings(tenant_id, project_id);
