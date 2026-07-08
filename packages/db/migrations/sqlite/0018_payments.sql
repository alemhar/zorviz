-- BACK-3-007: record how a finished job was paid. One row per recorded payment (the billing
-- flow records one at Mark-as-Paid). `amount` is the order total at payment time; `tendered` is
-- what the customer handed over; `change_due` is what was returned (0 for exact / non-cash).
-- Column is `change_due` (not `change`) to avoid any SQL-keyword ambiguity.
CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    method TEXT NOT NULL,          -- 'cash' | 'gcash' | 'card'
    amount INTEGER NOT NULL,       -- centavos
    tendered INTEGER NOT NULL,     -- centavos
    change_due INTEGER NOT NULL,   -- centavos
    processed_by TEXT,             -- user who took the payment
    created_at INTEGER NOT NULL
);
CREATE INDEX idx_payments_order ON payments(order_id);
