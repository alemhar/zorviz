// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

pub mod db;
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
                let pool = db::init_db(&handle).await.expect("failed to init db");
                handle.manage(db::DbState { pool });
                // Start local HTTP server
                server::start_server(handle.clone()).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, server::get_server_url, db::execute_sql])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
