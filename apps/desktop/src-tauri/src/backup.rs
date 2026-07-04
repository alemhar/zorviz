// Local backup & restore (BACK-0-008, D18). Consistent single-file backups via SQLite
// `VACUUM INTO`; restore is staged and applied on next launch (safe with an open DB).
// Never destructive: backups only add files; restore replaces the live DB only from a backup.

use serde::Serialize;
use serde_json::{json, Value};
use sqlx::{Pool, Row, Sqlite};
use std::path::{Path, PathBuf};

const KEEP: usize = 10; // rolling retention
const RESTORE_PENDING: &str = "restore-pending.db";
const DB_FILE: &str = "zorviz.db";

#[derive(Serialize)]
pub struct BackupInfo {
    pub name: String,
    pub size: u64,
    pub modified: i64,
}

/// Resolve the backup folder from app_config (or default to <data>/backups) and ensure it exists.
pub async fn resolve_backup_dir(pool: &Pool<Sqlite>, data_dir: &Path) -> PathBuf {
    let configured: Option<String> = sqlx::query("SELECT backup_dir FROM app_config WHERE id = 'default' LIMIT 1")
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .and_then(|r| r.try_get::<Option<String>, _>("backup_dir").ok())
        .flatten()
        .filter(|s| !s.trim().is_empty());
    let dir = configured.map(PathBuf::from).unwrap_or_else(|| data_dir.join("backups"));
    let _ = std::fs::create_dir_all(&dir);
    dir
}

/// Create a consistent backup copy. Returns the file name. Idempotent within a second.
pub async fn backup_now(pool: &Pool<Sqlite>, data_dir: &Path) -> Result<String, String> {
    let dir = resolve_backup_dir(pool, data_dir).await;
    let name = format!("zorviz-{}.db", chrono::Utc::now().format("%Y%m%d-%H%M%S"));
    let path = dir.join(&name);
    if !path.exists() {
        // VACUUM INTO writes a clean, WAL-consistent single-file copy.
        sqlx::query("VACUUM INTO ?")
            .bind(path.to_string_lossy().to_string())
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
        prune(&dir);
    }
    Ok(name)
}

fn prune(dir: &Path) {
    let mut backups: Vec<PathBuf> = std::fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with("zorviz-") && n.ends_with(".db"))
                .unwrap_or(false)
        })
        .collect();
    backups.sort(); // timestamped names sort chronologically
    if backups.len() > KEEP {
        for old in &backups[..backups.len() - KEEP] {
            let _ = std::fs::remove_file(old);
        }
    }
}

pub async fn list_backups(pool: &Pool<Sqlite>, data_dir: &Path) -> Vec<Value> {
    let dir = resolve_backup_dir(pool, data_dir).await;
    let mut out: Vec<BackupInfo> = std::fs::read_dir(&dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            if !(name.starts_with("zorviz-") && name.ends_with(".db")) {
                return None;
            }
            let meta = e.metadata().ok()?;
            let modified = meta
                .modified()
                .ok()
                .and_then(|m| m.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0);
            Some(BackupInfo { name, size: meta.len(), modified })
        })
        .collect();
    out.sort_by(|a, b| b.modified.cmp(&a.modified)); // newest first
    out.into_iter().map(|b| json!({ "name": b.name, "size": b.size, "modified": b.modified })).collect()
}

/// Stage a backup to be restored on next launch. Validates the filename (no path traversal).
pub async fn stage_restore(pool: &Pool<Sqlite>, data_dir: &Path, filename: &str) -> Result<(), String> {
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err("invalid backup name".to_string());
    }
    let dir = resolve_backup_dir(pool, data_dir).await;
    let src = dir.join(filename);
    if !src.exists() {
        return Err("backup not found".to_string());
    }
    std::fs::copy(&src, data_dir.join(RESTORE_PENDING)).map_err(|e| e.to_string())?;
    Ok(())
}

/// Apply a staged restore, if any. MUST be called before the DB pool is opened.
pub fn apply_pending_restore(data_dir: &Path) {
    let pending = data_dir.join(RESTORE_PENDING);
    if !pending.exists() {
        return;
    }
    let db = data_dir.join(DB_FILE);
    // Remove the live DB + stale WAL/SHM, then move the backup into place.
    let _ = std::fs::remove_file(&db);
    let _ = std::fs::remove_file(data_dir.join(format!("{}-wal", DB_FILE)));
    let _ = std::fs::remove_file(data_dir.join(format!("{}-shm", DB_FILE)));
    if std::fs::rename(&pending, &db).is_err() {
        // Cross-volume rename can fail; fall back to copy.
        let _ = std::fs::copy(&pending, &db);
        let _ = std::fs::remove_file(&pending);
    }
}
