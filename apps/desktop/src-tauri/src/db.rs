use sqlx::{migrate::MigrateDatabase, sqlite::SqlitePoolOptions, Pool, Sqlite};
use std::fs;
use tauri::{AppHandle, Manager};

pub struct DbState {
    pub pool: Pool<Sqlite>,
}

pub async fn init_db(app_handle: &AppHandle) -> Result<Pool<Sqlite>, String> {
    let app_dir = app_handle.path().app_data_dir().expect("failed to get app data dir");
    
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    }

    let db_path = app_dir.join("zorviz.db");
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
