-- Master data, done properly: suppliers become real records instead of free text on receives.
-- Existing free-text names are promoted to records and back-linked. The legacy `supplier` text
-- column stays as a denormalized display name (kept in sync on write) so report queries stay flat.
CREATE TABLE suppliers (
    id             TEXT PRIMARY KEY NOT NULL,
    name           TEXT NOT NULL,
    contact_person TEXT,
    phone          TEXT,
    address        TEXT,
    notes          TEXT,
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL
);

ALTER TABLE inventory_adjustments ADD COLUMN supplier_id TEXT;

-- Promote existing free-text supplier names to records…
INSERT INTO suppliers (id, name, created_at, updated_at)
SELECT lower(hex(randomblob(16))), s.name,
       CAST(strftime('%s','now') AS INTEGER) * 1000,
       CAST(strftime('%s','now') AS INTEGER) * 1000
FROM (SELECT DISTINCT TRIM(supplier) AS name FROM inventory_adjustments
      WHERE supplier IS NOT NULL AND TRIM(supplier) != '') s;

-- …and back-link the receives that named them.
UPDATE inventory_adjustments
SET supplier_id = (SELECT s.id FROM suppliers s WHERE s.name = TRIM(inventory_adjustments.supplier))
WHERE supplier IS NOT NULL AND TRIM(supplier) != '';

-- Customer profiles get institutional memory.
ALTER TABLE customers ADD COLUMN notes TEXT;
