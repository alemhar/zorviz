-- Job ticket intake (BACK-2-004): store the initial inspection checklist as JSON on the order.
-- Incremental migration (the DB now holds real setup/test data — no more squashing 0000_init).
ALTER TABLE orders ADD COLUMN inspection TEXT;
