use axum::{
    routing::get,
    Router,
    response::Html,
    Json
};
use serde_json::{json, Value};
use std::net::{IpAddr, SocketAddr};
use local_ip_address::local_ip;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

pub struct ServerState {
    pub url: Mutex<Option<String>>,
}

#[tauri::command]
pub fn get_server_url(state: State<ServerState>) -> Option<String> {
    state.url.lock().unwrap().clone()
}

pub async fn start_server(app: AppHandle) {
    // Find local IP
    let my_local_ip = local_ip().unwrap_or(IpAddr::from([0, 0, 0, 0]));
    let port = 3030;
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let url = format!("http://{}:{}", my_local_ip, port);

    println!("Attempting to bind HTTP server to {}", addr);

    // Update state
    if let Some(state) = app.try_state::<ServerState>() {
        *state.url.lock().unwrap() = Some(url.clone());
    }

    // Build router
    let router = Router::new()
        .route("/", get(root_handler))
        .route("/api/info", get(info_handler));

    // Run server in background task
    tauri::async_runtime::spawn(async move {
        match tokio::net::TcpListener::bind(addr).await {
            Ok(listener) => {
                println!("Server running on {}", url);
                // Notify frontend (optional, in case it's already listening)
                let _ = app.emit("server-started", json!({ "url": url }));
                
                if let Err(e) = axum::serve(listener, router).await {
                    eprintln!("Server error: {}", e);
                }
            },
            Err(e) => {
                eprintln!("Failed to bind server port: {}", e);
            }
        }
    });
}

async fn root_handler() -> Html<&'static str> {
    Html("<h1>Zorviz Mechanic Node</h1><p>Online</p>")
}

async fn info_handler() -> Json<Value> {
    Json(json!({ 
        "status": "ok", 
        "service": "zorviz-desktop",
        "version": "0.1.0" 
    }))
}
