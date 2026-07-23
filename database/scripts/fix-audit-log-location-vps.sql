-- Ensure audit_logs.location exists (safe to re-run).
ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS location VARCHAR(255);
