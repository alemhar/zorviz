// Typed data endpoints for the shared HTTP API (D23, single path).
// The pattern here is the template every future resource (orders, inventory, ...) follows:
// a typed handler that guards auth where needed, queries via sqlx, and returns JSON —
// never raw SQL over the network.

use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Map, Value};
use sqlx::sqlite::SqliteRow;
use sqlx::{Column, Row, ValueRef};
use std::collections::HashMap;

use crate::auth::{session_from_headers, ApiState};

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

// Generic row -> JSON object (INTEGER -> number, REAL -> number, TEXT -> string, NULL -> null).
fn row_to_json(row: &SqliteRow) -> Map<String, Value> {
    let mut map = Map::new();
    for col in row.columns() {
        let name = col.name();
        // Check NULL first: try_get::<i64> can decode a NULL as 0, which is wrong.
        let is_null = row.try_get_raw(name).map(|v| v.is_null()).unwrap_or(true);
        let value: Value = if is_null {
            Value::Null
        } else if let Ok(v) = row.try_get::<i64, _>(name) {
            Value::from(v)
        } else if let Ok(v) = row.try_get::<f64, _>(name) {
            serde_json::Number::from_f64(v).map(Value::Number).unwrap_or(Value::Null)
        } else if let Ok(v) = row.try_get::<String, _>(name) {
            Value::String(v)
        } else {
            Value::Null
        };
        map.insert(name.to_string(), value);
    }
    map
}

// Parse a stored `specs` JSON string into a nested object (assets store specs as text).
fn expand_specs(obj: &mut Map<String, Value>) {
    if let Some(Value::String(s)) = obj.get("specs") {
        if let Ok(parsed) = serde_json::from_str::<Value>(s) {
            obj.insert("specs".to_string(), parsed);
        }
    }
    obj.insert("pendingBookings".to_string(), json!([]));
}

/// GET /api/config — public (needed pre-login to render the login/setup screen). Returns
/// the app_config row or null. Branding only; low sensitivity on a LAN.
pub async fn get_config(State(state): State<ApiState>) -> Result<Json<Value>, (StatusCode, String)> {
    let row = sqlx::query("SELECT * FROM app_config WHERE id = 'default' LIMIT 1")
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    match row {
        Some(r) => Ok(Json(Value::Object(row_to_json(&r)))),
        None => Ok(Json(Value::Null)),
    }
}

/// GET /api/assets?q=... — search assets by id/specs. Auth required.
pub async fn search_assets(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Vec<Value>>, StatusCode> {
    if session_from_headers(&state, &headers).is_none() {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let q = params.get("q").cloned().unwrap_or_default();
    if q.trim().is_empty() {
        return Ok(Json(vec![]));
    }
    let like = format!("%{}%", q);
    let rows = sqlx::query(
        "SELECT * FROM assets WHERE (id LIKE ? OR specs LIKE ?) AND deleted_at IS NULL LIMIT 10",
    )
    .bind(&like)
    .bind(&like)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let out = rows
        .iter()
        .map(|r| {
            let mut obj = row_to_json(r);
            expand_specs(&mut obj);
            Value::Object(obj)
        })
        .collect();
    Ok(Json(out))
}

#[derive(Deserialize)]
pub struct CreateAssetReq {
    #[serde(rename = "type")]
    kind: String,
    specs: Value,
    owner_id: Option<String>,
}

/// POST /api/assets — create an asset. Auth required. tenant_id is taken from app_config
/// (single source of truth) rather than hardcoded.
pub async fn create_asset(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(req): Json<CreateAssetReq>,
) -> Result<Json<Value>, StatusCode> {
    if session_from_headers(&state, &headers).is_none() {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let tenant: String = sqlx::query("SELECT tenant_id FROM app_config WHERE id = 'default' LIMIT 1")
        .fetch_optional(&state.pool)
        .await
        .ok()
        .flatten()
        .and_then(|r| r.try_get::<String, _>("tenant_id").ok())
        .unwrap_or_else(|| "dev-tenant".to_string());

    let id = uuid::Uuid::new_v4().to_string();
    let now = now_ms();
    let specs_str = req.specs.to_string();

    sqlx::query(
        "INSERT INTO assets (id, tenant_id, owner_id, type, specs, created_at, updated_at, deleted_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL)",
    )
    .bind(&id)
    .bind(&tenant)
    .bind(&req.owner_id)
    .bind(&req.kind)
    .bind(&specs_str)
    .bind(now)
    .bind(now)
    .execute(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let row = sqlx::query("SELECT * FROM assets WHERE id = ? LIMIT 1")
        .bind(&id)
        .fetch_one(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut obj = row_to_json(&row);
    expand_specs(&mut obj);
    Ok(Json(Value::Object(obj)))
}
