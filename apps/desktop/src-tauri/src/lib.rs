// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

pub mod api_data;
pub mod auth;
pub mod backup;
pub mod db;
pub mod license;
pub mod server;

use tauri::Manager;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(server::ServerState { url: Mutex::new(None) })
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                // Apply a staged restore (if any) BEFORE opening the DB.
                backup::apply_pending_restore(&db::data_dir());

                let pool = db::init_db(&handle).await.expect("failed to init db");
                handle.manage(db::DbState { pool: pool.clone() });

                // Auto-backup on launch (best-effort; keeps a rolling set).
                let _ = backup::backup_now(&pool, &db::data_dir()).await;

                // Start local HTTP server (shared API for desktop + LAN devices)
                server::start_server(handle.clone(), pool).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, server::get_server_url, db::execute_sql])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
