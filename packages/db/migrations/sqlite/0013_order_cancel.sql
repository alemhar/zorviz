-- Cancel a job (non-destructive, D24): status → 'cancelled', with an optional reason kept
-- for the record. Admin/advisor only; not allowed once paid.
ALTER TABLE orders ADD COLUMN cancel_reason TEXT;
