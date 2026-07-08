-- Cloud sync prep (docs/cloud-sync-protocol.md §5): every synced table needs a monotonic change
-- marker so a push can send "rows changed since the last watermark". Two tables had no timestamps
-- (`inventory`, `order_items`); add them. Also add the client watermark to app_config. Append-only
-- tables (payments, inventory_adjustments) already have created_at and need no change.
-- Backend stays parked; these columns are inert until the sync engine reads them.

ALTER TABLE inventory ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inventory ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;

ALTER TABLE order_items ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;

ALTER TABLE app_config ADD COLUMN last_synced_at INTEGER NOT NULL DEFAULT 0;

-- Backfill existing rows to "now" (epoch ms) so they aren't stuck at 0.
UPDATE inventory
   SET created_at = CAST(strftime('%s','now') AS INTEGER) * 1000,
       updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
 WHERE created_at = 0;

UPDATE order_items
   SET created_at = CAST(strftime('%s','now') AS INTEGER) * 1000,
       updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
 WHERE created_at = 0;
