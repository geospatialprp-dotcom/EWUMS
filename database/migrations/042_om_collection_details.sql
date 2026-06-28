-- Stage 15.6: Revenue collection workflow metadata on payments

ALTER TABLE om_billing_payments ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}';
