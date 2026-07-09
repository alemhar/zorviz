-- BACK-3-016: receive ↔ expense linking + supplier payables. All soft/optional — a receive with
-- none of these behaves exactly as before. Outstanding payables = on_account=1 AND expense_id NULL
-- (settling later links the paying expense without clearing the historical on_account marker).
ALTER TABLE inventory_adjustments ADD COLUMN expense_id TEXT;   -- linked parts expense (paid now or settled later)
ALTER TABLE inventory_adjustments ADD COLUMN total_cost INTEGER; -- centavos: what was/will be paid for this receive
ALTER TABLE inventory_adjustments ADD COLUMN on_account INTEGER NOT NULL DEFAULT 0; -- 1 = supplier credit (payable)

-- BACK-3-017: mid-day drawer movements (POS paid-in/paid-out). NOT expenses — the money changes
-- location (till ↔ safe/owner), not ownership; profit is untouched. Close-day expected cash adds
-- cash_in and subtracts cash_drop within the session window.
CREATE TABLE drawer_movements (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,           -- 'cash_in' | 'cash_drop'
    amount INTEGER NOT NULL,      -- centavos
    note TEXT,
    author TEXT,
    created_at INTEGER NOT NULL   -- epoch ms; append-only change marker
);
CREATE INDEX idx_drawer_movements_created ON drawer_movements(created_at);
