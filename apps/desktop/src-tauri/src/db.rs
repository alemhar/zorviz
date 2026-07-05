use sqlx::{migrate::MigrateDatabase, sqlite::SqlitePoolOptions, Pool, Sqlite};
use std::fs;
use tauri::AppHandle;

pub struct DbState {
    pub pool: Pool<Sqlite>,
}

// PORTABLE MODE: the 'data' folder lives next to the executable (or CWD), or one level up
// when running from 'src-tauri' (dev) to avoid an infinite file-watch loop. Single source of
// truth for the data location (DB, license file, media).
pub fn data_dir() -> std::path::PathBuf {
    let cwd = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    if cwd.ends_with("src-tauri") {
        cwd.parent().map(|p| p.join("data")).unwrap_or_else(|| cwd.join("data"))
    } else {
        cwd.join("data")
    }
}

pub async fn init_db(_app_handle: &AppHandle) -> Result<Pool<Sqlite>, String> {
    let data_dir = data_dir();

    if !data_dir.exists() {
        fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    }

    let db_path = data_dir.join("zorviz.db");
    let db_url = format!("sqlite:{}", db_path.to_str().unwrap());

    if !Sqlite::database_exists(&db_url).await.unwrap_or(false) {
        Sqlite::create_database(&db_url).await.map_err(|e| e.to_string())?;
    }

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .map_err(|e| e.to_string())?;

    // Run migrations
    sqlx::migrate!("../../../packages/db/migrations/sqlite").run(&pool).await.map_err(|e| e.to_string())?;

    Ok(pool)
}
