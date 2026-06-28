-- Fix RA line amount: bill on current_qty, not total_qty; allow app-stored proportional amounts
ALTER TABLE ra_bill_lines DROP COLUMN IF EXISTS amount;
ALTER TABLE ra_bill_lines ADD COLUMN IF NOT EXISTS amount DECIMAL(14,2) DEFAULT 0;

-- Legacy imports: rate column sometimes held line total when contract_amount was missing
UPDATE boq_items
SET
  contract_amount = rate,
  rate = ROUND(rate / NULLIF(contract_qty, 0), 2)
WHERE (contract_amount IS NULL OR contract_amount = 0)
  AND contract_qty > 1
  AND rate > 0;

-- Recompute stored RA line amounts from current_qty × boq_rate (will be corrected again on next API read)
UPDATE ra_bill_lines
SET amount = ROUND(current_qty * boq_rate, 2)
WHERE amount IS NULL OR amount = 0;
