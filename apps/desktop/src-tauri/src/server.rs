use axum::{
    routing::{get, post},
    Router,
    response::Html,
    Json,
};
use serde_json::{json, Value};
use std::net::{IpAddr, SocketAddr};
use std::sync::{Arc, Mutex};
use local_ip_address::local_ip;
use sqlx::{Pool, Sqlite};
use tauri::{AppHandle, Emitter, Manager, State};
use tower_http::cors::CorsLayer;

use crate::auth::{self, ApiState, AuthState};

pub struct ServerState {
    pub url: Mutex<Option<String>>,
}

#[tauri::command]
pub fn get_server_url(state: State<ServerState>) -> Option<String> {
    state.url.lock().unwrap().clone()
}

pub async fn start_server(app: AppHandle, pool: Pool<Sqlite>) {
    let my_local_ip = local_ip().unwrap_or(IpAddr::from([0, 0, 0, 0]));
    let port = 3030;
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let url = format!("http://{}:{}", my_local_ip, port);

    println!("Attempting to bind HTTP server to {}", addr);

    if let Some(state) = app.try_state::<ServerState>() {
        *state.url.lock().unwrap() = Some(url.clone());
    }

    let api_state = ApiState {
        pool,
        auth: Arc::new(AuthState::default()),
    };

    // Increment 1: permissive CORS so the desktop webview (tauri origin) can reach
    // localhost:3030. Increment 2 (hardening) locks this to specific app origins.
    let cors = CorsLayer::permissive();

    let router = Router::new()
        .route("/", get(root_handler))
        .route("/api/info", get(info_handler))
        .route("/api/login", post(auth::login))
        .route("/api/logout", post(auth::logout))
        .route("/api/me", get(auth::me))
        .layer(cors)
        .with_state(api_state);

    tauri::async_runtime::spawn(async move {
        match tokio::net::TcpListener::bind(addr).await {
            Ok(listener) => {
                println!("Server running on {}", url);
                let _ = app.emit("server-started", json!({ "url": url }));

                if let Err(e) = axum::serve(listener, router).await {
                    eprintln!("Server error: {}", e);
                }
            }
            Err(e) => {
                eprintln!("Failed to bind server port: {}", e);
            }
        }
    });
}

async fn root_handler() -> Html<&'static str> {
    Html("<h1>Zorviz Node</h1><p>Online</p>")
}

async fn info_handler() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "service": "zorviz-desktop",
        "version": "0.1.0"
    }))
}
