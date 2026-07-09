-- BACK-3-016 follow-up: who the shop owes. Free-text supplier name on stock receives
-- (autocompleted client-side from prior values) — the payables list groups by it.
ALTER TABLE inventory_adjustments ADD COLUMN supplier TEXT;
