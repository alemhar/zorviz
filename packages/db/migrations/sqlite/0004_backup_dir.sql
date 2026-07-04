-- Backup & restore (BACK-0-008): shop-configurable backup destination folder.
-- Null → defaults to <data>/backups.
ALTER TABLE app_config ADD COLUMN backup_dir TEXT;
