-- BACK-3-010..013: financial layer — expenses, cash-drawer sessions, COGS snapshot, attribution.
-- All money INTEGER centavos; all timestamps INTEGER epoch-ms, per convention.

-- BACK-3-010: money-out log. Immutable; mistakes are soft-voided (sync has no hard deletes).
CREATE TABLE expenses (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,          -- 'parts' | 'salary' | 'utilities' | 'rent' | 'misc'
    amount INTEGER NOT NULL,         -- centavos
    note TEXT,
    paid_from_drawer INTEGER NOT NULL DEFAULT 1, -- 1 = cash out of the drawer (counts in reconciliation)
    author TEXT,                     -- who recorded it
    voided INTEGER NOT NULL DEFAULT 0,
    voided_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX idx_expenses_created ON expenses(created_at);

-- BACK-3-011: cash-drawer sessions (open day → close day). One open session at a time
-- (closed_at IS NULL = open). expected/counted/over_short are filled at close.
CREATE TABLE drawer_sessions (
    id TEXT PRIMARY KEY,
    opening_float INTEGER NOT NULL,  -- centavos in the drawer at open
    expected_cash INTEGER,           -- float + cash payments - drawer-paid expenses (at close)
    counted_cash INTEGER,            -- what staff actually counted
    over_short INTEGER,              -- counted - expected (negative = short)
    opened_by TEXT,
    closed_by TEXT,
    opened_at INTEGER NOT NULL,
    closed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- BACK-3-013: COGS snapshot — the linked part's unit_cost frozen when the estimate is saved,
-- so gross margin is immune to later inventory cost edits. NULL for services/unlinked lines.
ALTER TABLE order_items ADD COLUMN cost_at_sale INTEGER;

-- BACK-3-013: action attribution (actor display name, same pattern as payments.processed_by).
ALTER TABLE orders ADD COLUMN created_by TEXT;
ALTER TABLE orders ADD COLUMN cancelled_by TEXT;
ALTER TABLE orders ADD COLUMN discounted_by TEXT;
