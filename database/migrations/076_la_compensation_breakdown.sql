-- Automatic compensation calculation breakdown per parcel
ALTER TABLE la_compensation_schedules
    ADD COLUMN IF NOT EXISTS circle_rate_per_sqm DECIMAL(14, 2),
    ADD COLUMN IF NOT EXISTS market_rate_per_sqm DECIMAL(14, 2),
    ADD COLUMN IF NOT EXISTS affected_area_sqm DECIMAL(14, 2),
    ADD COLUMN IF NOT EXISTS land_compensation DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS additional_compensation DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tree_compensation DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS crop_compensation DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS interest_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rehabilitation_cost DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_compensation DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_acquisition_cost DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS calculation_breakdown JSONB NOT NULL DEFAULT '{}';
