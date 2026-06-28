-- Standardized ownership classification on LA parcels
ALTER TABLE la_parcels
  ADD COLUMN IF NOT EXISTS ownership_classification VARCHAR(80),
  ADD COLUMN IF NOT EXISTS ownership_classification_source VARCHAR(30),
  ADD COLUMN IF NOT EXISTS ownership_classification_details JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_la_parcels_ownership_class
  ON la_parcels(la_case_id, ownership_classification);
