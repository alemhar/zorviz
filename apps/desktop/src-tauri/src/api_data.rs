// Typed data endpoints for the shared HTTP API (D23, single path).
// The pattern here is the template every future resource (orders, inventory, ...) follows:
// a typed handler that guards auth where needed, queries via sqlx, and returns JSON —
// never raw SQL over the network.

use axum::{
    extract::{Path, Query, State},
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

// Single source of truth for tenant_id: read it from app_config (falls back to the dev value).
async fn tenant_id(state: &ApiState) -> String {
    sqlx::query("SELECT tenant_id FROM app_config WHERE id = 'default' LIMIT 1")
        .fetch_optional(&state.pool)
        .await
        .ok()
        .flatten()
        .and_then(|r| r.try_get::<String, _>("tenant_id").ok())
        .unwrap_or_else(|| "dev-tenant".to_string())
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

// Parse a stored JSON-string column into a nested object/array in place.
fn parse_json_field(obj: &mut Map<String, Value>, field: &str) {
    if let Some(Value::String(s)) = obj.get(field) {
        if let Ok(parsed) = serde_json::from_str::<Value>(s) {
            obj.insert(field.to_string(), parsed);
        }
    }
}

// Expand an asset's `specs` (stored as text) and attach an (empty) pendingBookings array.
fn expand_specs(obj: &mut Map<String, Value>) {
    parse_json_field(obj, "specs");
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

// ---- Customers ----

/// GET /api/customers?q=... — search customers by name/phone. Auth required.
pub async fn search_customers(
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
    let rows = sqlx::query("SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? LIMIT 10")
        .bind(&like)
        .bind(&like)
        .fetch_all(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(rows.iter().map(|r| Value::Object(row_to_json(r))).collect()))
}

#[derive(Deserialize)]
pub struct CreateCustomerReq {
    name: String,
    phone: Option<String>,
    email: Option<String>,
    address: Option<String>,
}

/// POST /api/customers — create a customer. Auth required. tenant from app_config.
pub async fn create_customer(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(req): Json<CreateCustomerReq>,
) -> Result<Json<Value>, StatusCode> {
    if session_from_headers(&state, &headers).is_none() {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let tenant = tenant_id(&state).await;
    let id = uuid::Uuid::new_v4().to_string();
    let now = now_ms();
    sqlx::query(
        "INSERT INTO customers (id, tenant_id, name, phone, email, address, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&tenant)
    .bind(req.name.trim())
    .bind(&req.phone)
    .bind(&req.email)
    .bind(&req.address)
    .bind(now)
    .bind(now)
    .execute(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let row = sqlx::query("SELECT * FROM customers WHERE id = ? LIMIT 1")
        .bind(&id)
        .fetch_one(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(Value::Object(row_to_json(&row))))
}

// ---- Assets ----

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

    let tenant = tenant_id(&state).await;
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

// ---- Job tickets (orders) ----

#[derive(Deserialize)]
pub struct CreateOrderReq {
    asset_id: String,
    customer_complaint: Option<String>,
    inspection: Option<Value>,
}

/// POST /api/orders — create a job ticket at status `triage`. Auth required.
/// customer_id is derived from the asset's owner.
pub async fn create_order(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(req): Json<CreateOrderReq>,
) -> Result<Json<Value>, StatusCode> {
    if session_from_headers(&state, &headers).is_none() {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Derive customer from the asset's owner.
    let customer_id: Option<String> = sqlx::query("SELECT owner_id FROM assets WHERE id = ? LIMIT 1")
        .bind(&req.asset_id)
        .fetch_optional(&state.pool)
        .await
        .ok()
        .flatten()
        .and_then(|r| r.try_get::<Option<String>, _>("owner_id").ok())
        .flatten();

    let id = uuid::Uuid::new_v4().to_string();
    let now = now_ms();
    let inspection_str = req.inspection.as_ref().map(|v| v.to_string());

    sqlx::query(
        "INSERT INTO orders (id, asset_id, customer_id, status, customer_complaint, inspection, \
         subtotal, tax, discount, total, created_at, updated_at) \
         VALUES (?, ?, ?, 'triage', ?, ?, 0, 0, 0, 0, ?, ?)",
    )
    .bind(&id)
    .bind(&req.asset_id)
    .bind(&customer_id)
    .bind(&req.customer_complaint)
    .bind(&inspection_str)
    .bind(now)
    .bind(now)
    .execute(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    order_detail(&state, &id).await.ok_or(StatusCode::INTERNAL_SERVER_ERROR).map(Json)
}

/// GET /api/orders/:id — a job ticket with its asset and customer embedded. Auth required.
pub async fn get_order(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    if session_from_headers(&state, &headers).is_none() {
        return Err(StatusCode::UNAUTHORIZED);
    }
    order_detail(&state, &id).await.ok_or(StatusCode::NOT_FOUND).map(Json)
}

// Build a job-ticket detail object: order fields (inspection parsed) + nested asset + customer.
async fn order_detail(state: &ApiState, id: &str) -> Option<Value> {
    let row = sqlx::query("SELECT * FROM orders WHERE id = ? LIMIT 1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .ok()
        .flatten()?;
    let mut obj = row_to_json(&row);
    parse_json_field(&mut obj, "inspection");

    if let Some(asset_id) = obj.get("asset_id").and_then(|v| v.as_str()).map(String::from) {
        if let Ok(Some(arow)) = sqlx::query("SELECT * FROM assets WHERE id = ? LIMIT 1")
            .bind(&asset_id)
            .fetch_optional(&state.pool)
            .await
        {
            let mut a = row_to_json(&arow);
            parse_json_field(&mut a, "specs");
            obj.insert("asset".to_string(), Value::Object(a));
        }
    }

    if let Some(customer_id) = obj.get("customer_id").and_then(|v| v.as_str()).map(String::from) {
        if let Ok(Some(crow)) = sqlx::query("SELECT * FROM customers WHERE id = ? LIMIT 1")
            .bind(&customer_id)
            .fetch_optional(&state.pool)
            .await
        {
            obj.insert("customer".to_string(), Value::Object(row_to_json(&crow)));
        }
    }

    Some(Value::Object(obj))
}
