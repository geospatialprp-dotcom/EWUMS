-- Pinpoint audit locations from device GPS (browser geolocation at login).

ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS location_accuracy_meters DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_audit_logs_gps
  ON audit_logs (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
