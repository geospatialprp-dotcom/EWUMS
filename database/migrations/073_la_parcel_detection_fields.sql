-- Extended automatic parcel detection fields
ALTER TABLE la_parcels
  ADD COLUMN IF NOT EXISTS affected_length_m DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS row_width_m DECIMAL(8, 2),
  ADD COLUMN IF NOT EXISTS temporary_area_sqm DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS permanent_area_sqm DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS ownership_type VARCHAR(80),
  ADD COLUMN IF NOT EXISTS department VARCHAR(255),
  ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS land_category VARCHAR(80),
  ADD COLUMN IF NOT EXISTS current_status VARCHAR(80),
  ADD COLUMN IF NOT EXISTS mutation_status VARCHAR(80);
