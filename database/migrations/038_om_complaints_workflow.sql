-- Stage 10: Consumer complaint management workflow extensions

ALTER TABLE om_consumer_complaints
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id),
  ADD COLUMN IF NOT EXISTS om_consumer_id UUID REFERENCES om_consumers(id),
  ADD COLUMN IF NOT EXISTS reported_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_time_mins INT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE om_consumer_complaints SET status = 'ticket_generated' WHERE status = 'registered';
UPDATE om_consumer_complaints SET channel = 'web_portal' WHERE channel = 'web';

CREATE INDEX IF NOT EXISTS idx_om_complaints_project ON om_consumer_complaints(project_id);
CREATE INDEX IF NOT EXISTS idx_om_complaints_status ON om_consumer_complaints(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_om_complaints_consumer ON om_consumer_complaints(om_consumer_id);
