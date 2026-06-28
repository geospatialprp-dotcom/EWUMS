-- L1 Contractor BOQ (separate from government / original BOQ)
ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS boq_source VARCHAR(20) NOT NULL DEFAULT 'government';
ALTER TABLE work_planning ADD COLUMN IF NOT EXISTS l1_contractor_boq_upload_url TEXT;

UPDATE boq_items SET boq_source = 'government' WHERE boq_source IS NULL OR boq_source = '';

CREATE INDEX IF NOT EXISTS idx_boq_items_source ON boq_items(project_id, boq_source, is_active);
