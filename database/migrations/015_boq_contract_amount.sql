-- Store Excel "Total Amount with Tax" per BOQ line for accurate section/grand totals
ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS contract_amount DECIMAL(16, 2) DEFAULT 0;

UPDATE boq_items
SET contract_amount = ROUND(contract_qty * rate, 2)
WHERE contract_amount = 0 OR contract_amount IS NULL;
