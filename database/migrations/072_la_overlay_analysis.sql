-- LA overlay analysis: store GIS layer source on clearance items
ALTER TABLE la_clearance_items
  ADD COLUMN IF NOT EXISTS overlay_layer_code VARCHAR(80),
  ADD COLUMN IF NOT EXISTS source_feature_id UUID,
  ADD COLUMN IF NOT EXISTS source_feature_class_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_la_clearances_overlay
  ON la_clearance_items(la_case_id, overlay_layer_code);
