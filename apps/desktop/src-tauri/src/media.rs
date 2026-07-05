// BACK-0-013: shop logo storage. The logo is written to {data_dir}/media/ and served
// back over HTTP so the desktop webview, LAN phones, and the invoice PDF all render it
// the same way. Single logo per shop (fixed basename), so replacing overwrites.

use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::Deserialize;
use serde_json::{json, Value};
use std::fs;

use crate::api_data::{now_ms, require_admin, require_staff, row_to_json};
use crate::auth::{session_from_headers, ApiState};

const MAX_BYTES: usize = 2 * 1024 * 1024; // 2 MB (logo)
const PHOTO_MAX_BYTES: usize = 8 * 1024 * 1024; // 8 MB (photos; client downscales first)

fn media_dir() -> std::path::PathBuf {
    crate::db::data_dir().join("media")
}

// Allowed image extensions -> MIME type.
fn ext_mime(ext: &str) -> Option<&'static str> {
    match ext.to_ascii_lowercase().as_str() {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "webp" => Some("image/webp"),
        "gif" => Some("image/gif"),
        _ => None,
    }
}

// Remove any existing media/logo.* so replacing with a different extension can't leave
// a stale file behind.
fn remove_existing_logos() {
    if let Ok(entries) = fs::read_dir(media_dir()) {
        for e in entries.flatten() {
            if e.file_name().to_string_lossy().starts_with("logo.") {
                let _ = fs::remove_file(e.path());
            }
        }
    }
}

#[derive(Deserialize)]
pub struct LogoUploadReq {
    data: String, // base64 (with or without a data: URL prefix)
    ext: String,
}

// POST /api/logo — save the shop logo (admin only).
pub async fn upload_logo(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(req): Json<LogoUploadReq>,
) -> Result<Json<Value>, (StatusCode, String)> {
    require_admin(&state, &headers).map_err(|s| (s, "admin only".to_string()))?;

    let ext = req.ext.trim().to_ascii_lowercase();
    if ext_mime(&ext).is_none() {
        return Err((StatusCode::BAD_REQUEST, "unsupported image type (use png/jpg/webp/gif)".to_string()));
    }
    // Accept a raw base64 string or a full data: URL.
    let b64 = req.data.split(',').last().unwrap_or("").trim();
    let bytes = B64.decode(b64).map_err(|_| (StatusCode::BAD_REQUEST, "invalid image data".to_string()))?;
    if bytes.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "empty image".to_string()));
    }
    if bytes.len() > MAX_BYTES {
        return Err((StatusCode::PAYLOAD_TOO_LARGE, "image too large (max 2 MB)".to_string()));
    }

    let dir = media_dir();
    fs::create_dir_all(&dir).map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "media dir failed".to_string()))?;
    remove_existing_logos();
    let filename = format!("logo.{}", ext);
    fs::write(dir.join(&filename), &bytes)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "write failed".to_string()))?;

    let rel = format!("media/{}", filename);
    sqlx::query("UPDATE app_config SET logo_path = ?, updated_at = ? WHERE id = 'default'")
        .bind(&rel)
        .bind(now_ms())
        .execute(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "config update failed".to_string()))?;

    Ok(Json(json!({ "ok": true, "logo_path": rel })))
}

// DELETE /api/logo — remove the shop logo (admin only).
pub async fn delete_logo(
    State(state): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<Value>, (StatusCode, String)> {
    require_admin(&state, &headers).map_err(|s| (s, "admin only".to_string()))?;
    remove_existing_logos();
    sqlx::query("UPDATE app_config SET logo_path = NULL, updated_at = ? WHERE id = 'default'")
        .bind(now_ms())
        .execute(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "config update failed".to_string()))?;
    Ok(Json(json!({ "ok": true })))
}

// GET /api/logo — serve the current logo bytes. Public (the login screen shows it before
// any user is authenticated). 404 when no logo is set.
pub async fn get_logo(State(state): State<ApiState>) -> Response {
    let rel: Option<String> = sqlx::query_scalar("SELECT logo_path FROM app_config WHERE id = 'default' LIMIT 1")
        .fetch_optional(&state.pool)
        .await
        .ok()
        .flatten();
    let rel = match rel {
        Some(r) if !r.is_empty() => r,
        _ => return (StatusCode::NOT_FOUND, "no logo").into_response(),
    };
    let path = crate::db::data_dir().join(&rel);
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    let mime = ext_mime(ext).unwrap_or("application/octet-stream");
    match fs::read(&path) {
        Ok(bytes) => {
            let mut resp = Response::new(Body::from(bytes));
            resp.headers_mut().insert(header::CONTENT_TYPE, header::HeaderValue::from_static(mime));
            resp.headers_mut().insert(header::CACHE_CONTROL, header::HeaderValue::from_static("no-cache"));
            resp
        }
        Err(_) => (StatusCode::NOT_FOUND, "no logo").into_response(),
    }
}

// ---- Job-ticket photos (BACK-2-011) ----

fn decode_image(data: &str, max: usize) -> Result<Vec<u8>, (StatusCode, String)> {
    let b64 = data.split(',').last().unwrap_or("").trim();
    let bytes = B64.decode(b64).map_err(|_| (StatusCode::BAD_REQUEST, "invalid image data".to_string()))?;
    if bytes.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "empty image".to_string()));
    }
    if bytes.len() > max {
        return Err((StatusCode::PAYLOAD_TOO_LARGE, "image too large".to_string()));
    }
    Ok(bytes)
}

// Fetch a photo row's notes (oldest -> newest) as a JSON array.
async fn notes_for(state: &ApiState, photo_id: &str) -> Vec<Value> {
    sqlx::query("SELECT * FROM photo_notes WHERE photo_id = ? ORDER BY created_at ASC")
        .bind(photo_id)
        .fetch_all(&state.pool)
        .await
        .map(|rows| rows.iter().map(|r| Value::Object(row_to_json(r))).collect())
        .unwrap_or_default()
}

#[derive(Deserialize)]
pub struct UploadPhotoReq {
    data: String,     // base64 (client already downscaled), raw or data: URL
    ext: Option<String>,
}

// POST /api/orders/:id/photos — attach a photo (any authenticated staff, incl. mechanics).
pub async fn upload_photo(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(order_id): Path<String>,
    Json(req): Json<UploadPhotoReq>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let session = session_from_headers(&state, &headers)
        .ok_or((StatusCode::UNAUTHORIZED, "unauthorized".to_string()))?;
    let ext = req.ext.as_deref().unwrap_or("jpg").trim().to_ascii_lowercase();
    if ext_mime(&ext).is_none() {
        return Err((StatusCode::BAD_REQUEST, "unsupported image type".to_string()));
    }
    let bytes = decode_image(&req.data, PHOTO_MAX_BYTES)?;

    let dir = crate::db::data_dir().join("media").join("orders").join(&order_id);
    fs::create_dir_all(&dir).map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "media dir failed".to_string()))?;
    let id = uuid::Uuid::new_v4().to_string();
    let filename = format!("{}.{}", id, ext);
    fs::write(dir.join(&filename), &bytes)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "write failed".to_string()))?;

    let rel = format!("media/orders/{}/{}", order_id, filename);
    let now = now_ms();
    sqlx::query("INSERT INTO order_photos (id, order_id, path, created_by, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(&id)
        .bind(&order_id)
        .bind(&rel)
        .bind(&session.name)
        .bind(now)
        .execute(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "insert failed".to_string()))?;

    Ok(Json(json!({
        "id": id, "order_id": order_id, "path": rel, "created_by": session.name,
        "created_at": now, "notes": []
    })))
}

// GET /api/orders/:id/photos — list photos (newest first), each with its note thread.
pub async fn list_photos(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(order_id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    if session_from_headers(&state, &headers).is_none() {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let rows = sqlx::query("SELECT * FROM order_photos WHERE order_id = ? ORDER BY created_at DESC")
        .bind(&order_id)
        .fetch_all(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut out = Vec::with_capacity(rows.len());
    for r in &rows {
        let mut obj = row_to_json(r);
        let pid = obj.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        obj.insert("notes".to_string(), Value::Array(notes_for(&state, &pid).await));
        out.push(Value::Object(obj));
    }
    Ok(Json(Value::Array(out)))
}

// GET /api/photos/:id — stream the photo bytes. Public (same-origin <img>, unguessable id).
pub async fn get_photo(State(state): State<ApiState>, Path(id): Path<String>) -> Response {
    let rel: Option<String> = sqlx::query_scalar("SELECT path FROM order_photos WHERE id = ? LIMIT 1")
        .bind(&id)
        .fetch_optional(&state.pool)
        .await
        .ok()
        .flatten();
    let rel = match rel {
        Some(r) => r,
        None => return (StatusCode::NOT_FOUND, "not found").into_response(),
    };
    let path = crate::db::data_dir().join(&rel);
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    let mime = ext_mime(ext).unwrap_or("application/octet-stream");
    match fs::read(&path) {
        Ok(bytes) => {
            let mut resp = Response::new(Body::from(bytes));
            resp.headers_mut().insert(header::CONTENT_TYPE, header::HeaderValue::from_static(mime));
            resp
        }
        Err(_) => (StatusCode::NOT_FOUND, "not found").into_response(),
    }
}

#[derive(Deserialize)]
pub struct AddNoteReq {
    note: String,
}

// POST /api/photos/:id/notes — append a note (any authenticated staff, incl. mechanics).
pub async fn add_note(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(photo_id): Path<String>,
    Json(req): Json<AddNoteReq>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let session = session_from_headers(&state, &headers)
        .ok_or((StatusCode::UNAUTHORIZED, "unauthorized".to_string()))?;
    if req.note.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "empty note".to_string()));
    }
    let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM order_photos WHERE id = ?")
        .bind(&photo_id)
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);
    if exists == 0 {
        return Err((StatusCode::NOT_FOUND, "photo not found".to_string()));
    }
    let id = uuid::Uuid::new_v4().to_string();
    let now = now_ms();
    sqlx::query("INSERT INTO photo_notes (id, photo_id, author, note, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(&id)
        .bind(&photo_id)
        .bind(&session.name)
        .bind(req.note.trim())
        .bind(now)
        .execute(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "insert failed".to_string()))?;
    Ok(Json(json!({ "id": id, "photo_id": photo_id, "author": session.name, "note": req.note.trim(), "created_at": now })))
}

// DELETE /api/photos/:id — remove a photo + its notes + the file (advisor/admin only).
pub async fn delete_photo(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    require_staff(&state, &headers).map_err(|s| (s, "staff only".to_string()))?;
    let rel: Option<String> = sqlx::query_scalar("SELECT path FROM order_photos WHERE id = ? LIMIT 1")
        .bind(&id)
        .fetch_optional(&state.pool)
        .await
        .ok()
        .flatten();
    let rel = match rel {
        Some(r) => r,
        None => return Err((StatusCode::NOT_FOUND, "photo not found".to_string())),
    };
    // Remove notes, then the photo row, then the file (idempotent).
    let _ = sqlx::query("DELETE FROM photo_notes WHERE photo_id = ?").bind(&id).execute(&state.pool).await;
    let _ = sqlx::query("DELETE FROM order_photos WHERE id = ?").bind(&id).execute(&state.pool).await;
    let _ = fs::remove_file(crate::db::data_dir().join(&rel));
    Ok(Json(json!({ "ok": true })))
}
