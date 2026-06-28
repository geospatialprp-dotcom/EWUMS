-- Contractor Purchase Order document on work planning
ALTER TABLE work_planning ADD COLUMN IF NOT EXISTS contractor_po_upload_url TEXT;
