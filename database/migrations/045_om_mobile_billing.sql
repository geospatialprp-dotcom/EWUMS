-- Stage 15.11: Mobile Billing Application — field capture metadata

ALTER TABLE om_meter_readings
    ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_om_meter_readings_details ON om_meter_readings USING gin (details);
