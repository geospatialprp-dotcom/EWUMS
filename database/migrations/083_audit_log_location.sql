-- Activity log: optional location label (city/country from headers or geo lookup at write time).
-- ip_address already exists on audit_logs from 001_platform_schema.sql / 001_auth_core.sql.

ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS location VARCHAR(255);
