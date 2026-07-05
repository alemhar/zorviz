// BACK-1-006: data-driven shop asset types. Types + their fields are stored in the
// `asset_types` table, not hardcoded. The three former built-in types ship as
// templates (seed data) so the target market gets a zero-config setup.

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{Pool, Row, Sqlite};

use crate::api_data::{now_ms, parse_json_field, require_admin, row_to_json, tenant_id};
use crate::auth::{session_from_headers, ApiState};

// A field definition as sent by the client / stored in the `fields` JSON column.
#[derive(Deserialize)]
pub struct FieldDef {
    pub key: Option<String>,
    pub label: String,
    pub kind: Option<String>, // "text" | "number"
    #[serde(default)]
    pub required: bool,
}

// A type definition sent by the setup wizard or the settings editor.
#[derive(Deserialize)]
pub struct AssetTypeInput {
    pub key: Option<String>,
    pub name: String,
    pub icon: Option<String>,
    pub fields: Vec<FieldDef>,
    pub show_on_create: Option<bool>,
}

// Turn a label/name into a stable slug key.
fn slugify(s: &str) -> String {
    let slug: String = s
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    let slug = slug.trim_matches('-').replace("--", "-");
    if slug.is_empty() {
        "type".to_string()
    } else {
        slug
    }
}

// Normalize a list of field defs into the JSON stored in the `fields` column.
fn fields_json(fields: &[FieldDef]) -> String {
    let arr: Vec<Value> = fields
        .iter()
        .filter(|f| !f.label.trim().is_empty())
        .map(|f| {
            let key = f
                .key
                .as_ref()
                .map(|k| k.trim().to_string())
                .filter(|k| !k.is_empty())
                .unwrap_or_else(|| slugify(&f.label));
            let kind = match f.kind.as_deref() {
                Some("number") => "number",
                _ => "text",
            };
            json!({ "key": key, "label": f.label.trim(), "kind": kind, "required": f.required })
        })
        .collect();
    Value::Array(arr).to_string()
}

// The built-in starter templates (single source of truth, also served to the wizard).
pub fn builtin_templates() -> Value {
    json!([
        {
            "key": "vehicle", "name": "Vehicle", "icon": "car",
            "fields": [
                {"key":"plateNumber","label":"Plate Number","kind":"text","required":false},
                {"key":"vin","label":"VIN","kind":"text","required":false},
                {"key":"make","label":"Make","kind":"text","required":false},
                {"key":"model","label":"Model","kind":"text","required":false},
                {"key":"year","label":"Year","kind":"number","required":false},
                {"key":"color","label":"Color","kind":"text","required":false},
                {"key":"mileage","label":"Mileage","kind":"number","required":false}
            ]
        },
        {
            "key": "gadget", "name": "Gadget", "icon": "smartphone",
            "fields": [
                {"key":"brand","label":"Brand","kind":"text","required":false},
                {"key":"model","label":"Model","kind":"text","required":false},
                {"key":"serialNumber","label":"Serial Number","kind":"text","required":false},
                {"key":"imei","label":"IMEI","kind":"text","required":false},
                {"key":"color","label":"Color","kind":"text","required":false}
            ]
        },
        {
            "key": "appliance", "name": "Appliance", "icon": "package",
            "fields": [
                {"key":"brand","label":"Brand","kind":"text","required":false},
                {"key":"model","label":"Model","kind":"text","required":false},
                {"key":"serialNumber","label":"Serial Number","kind":"text","required":false}
            ]
        }
    ])
}

// Insert one asset type for a tenant. `key` is made unique per tenant by suffixing.
// Used by the setup wizard (seeding chosen templates) and the create endpoint.
pub async fn insert_type(
    pool: &Pool<Sqlite>,
    tenant: &str,
    input: &AssetTypeInput,
    sort_order: i64,
) -> Result<String, sqlx::Error> {
    let base_key = input
        .key
        .as_ref()
        .map(|k| slugify(k))
        .unwrap_or_else(|| slugify(&input.name));

    // Ensure key uniqueness within the tenant.
    let mut key = base_key.clone();
    let mut n = 1;
    loop {
        let taken: i64 = sqlx::query("SELECT COUNT(*) AS c FROM asset_types WHERE tenant_id = ? AND key = ?")
            .bind(tenant)
            .bind(&key)
            .fetch_one(pool)
            .await?
            .try_get::<i64, _>("c")
            .unwrap_or(0);
        if taken == 0 {
            break;
        }
        n += 1;
        key = format!("{}-{}", base_key, n);
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = now_ms();
    let show = if input.show_on_create.unwrap_or(true) { 1 } else { 0 };
    sqlx::query(
        "INSERT INTO asset_types (id, tenant_id, key, name, icon, fields, show_on_create, sort_order, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(tenant)
    .bind(&key)
    .bind(input.name.trim())
    .bind(&input.icon)
    .bind(fields_json(&input.fields))
    .bind(show)
    .bind(sort_order)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await?;
    Ok(id)
}

// Seed the built-in templates for a tenant (used at setup when no selection is given,
// and by the startup back-compat path for older installs).
pub async fn seed_builtins(pool: &Pool<Sqlite>, tenant: &str) -> Result<(), sqlx::Error> {
    let templates: Vec<AssetTypeInput> =
        serde_json::from_value(builtin_templates()).unwrap_or_default();
    for (i, t) in templates.iter().enumerate() {
        insert_type(pool, tenant, t, i as i64).await?;
    }
    Ok(())
}

// If the app is already set up (has an app_config) but has no asset types yet — an
// install that predates this feature — seed the built-in templates. No-op otherwise.
pub async fn ensure_seeded_for_existing_install(pool: &Pool<Sqlite>) {
    let has_config: i64 = sqlx::query("SELECT COUNT(*) AS c FROM app_config")
        .fetch_one(pool)
        .await
        .ok()
        .and_then(|r| r.try_get::<i64, _>("c").ok())
        .unwrap_or(0);
    let has_types: i64 = sqlx::query("SELECT COUNT(*) AS c FROM asset_types")
        .fetch_one(pool)
        .await
        .ok()
        .and_then(|r| r.try_get::<i64, _>("c").ok())
        .unwrap_or(0);
    if has_config > 0 && has_types == 0 {
        let tenant = sqlx::query("SELECT tenant_id FROM app_config WHERE id = 'default' LIMIT 1")
            .fetch_optional(pool)
            .await
            .ok()
            .flatten()
            .and_then(|r| r.try_get::<String, _>("tenant_id").ok())
            .unwrap_or_else(|| "dev-tenant".to_string());
        let _ = seed_builtins(pool, &tenant).await;
    }
}

// GET /api/asset-type-templates — the built-in starter templates. Public (used by the
// setup wizard before login).
pub async fn get_templates() -> Json<Value> {
    Json(builtin_templates())
}

// GET /api/asset-types — the shop's asset types, ordered. Auth required.
pub async fn list_asset_types(
    State(state): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<Value>, StatusCode> {
    if session_from_headers(&state, &headers).is_none() {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let rows = sqlx::query("SELECT * FROM asset_types ORDER BY sort_order, name")
        .fetch_all(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let out: Vec<Value> = rows
        .iter()
        .map(|r| {
            let mut obj = row_to_json(r);
            parse_json_field(&mut obj, "fields");
            Value::Object(obj)
        })
        .collect();
    Ok(Json(Value::Array(out)))
}

// POST /api/asset-types — create a type (admin only).
pub async fn create_asset_type(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(req): Json<AssetTypeInput>,
) -> Result<Json<Value>, (StatusCode, String)> {
    require_admin(&state, &headers).map_err(|s| (s, "admin only".to_string()))?;
    if req.name.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "type name is required".to_string()));
    }
    let tenant = tenant_id(&state).await;
    let next_sort: i64 = sqlx::query("SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM asset_types WHERE tenant_id = ?")
        .bind(&tenant)
        .fetch_one(&state.pool)
        .await
        .ok()
        .and_then(|r| r.try_get::<i64, _>("n").ok())
        .unwrap_or(0);
    let id = insert_type(&state.pool, &tenant, &req, next_sort)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "create failed".to_string()))?;
    fetch_one(&state.pool, &id).await
}

// PUT /api/asset-types/:id — update a type's name/icon/fields/toggle/order (admin only).
pub async fn update_asset_type(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<AssetTypeInput>,
) -> Result<Json<Value>, (StatusCode, String)> {
    require_admin(&state, &headers).map_err(|s| (s, "admin only".to_string()))?;
    if req.name.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "type name is required".to_string()));
    }
    let now = now_ms();
    let show = if req.show_on_create.unwrap_or(true) { 1 } else { 0 };
    // `key` is intentionally NOT updated — it links existing assets to this type.
    let result = sqlx::query(
        "UPDATE asset_types SET name = ?, icon = ?, fields = ?, show_on_create = ?, updated_at = ? WHERE id = ?",
    )
    .bind(req.name.trim())
    .bind(&req.icon)
    .bind(fields_json(&req.fields))
    .bind(show)
    .bind(now)
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "update failed".to_string()))?;
    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "asset type not found".to_string()));
    }
    fetch_one(&state.pool, &id).await
}

// DELETE /api/asset-types/:id — remove a type (admin only). Existing assets keep their
// stored type string + specs (D24); detail/edit fall back to raw keys for a missing type.
pub async fn delete_asset_type(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    require_admin(&state, &headers).map_err(|s| (s, "admin only".to_string()))?;
    let result = sqlx::query("DELETE FROM asset_types WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "delete failed".to_string()))?;
    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "asset type not found".to_string()));
    }
    Ok(Json(json!({ "ok": true })))
}

async fn fetch_one(pool: &Pool<Sqlite>, id: &str) -> Result<Json<Value>, (StatusCode, String)> {
    let row = sqlx::query("SELECT * FROM asset_types WHERE id = ? LIMIT 1")
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "reload failed".to_string()))?;
    let mut obj = row_to_json(&row);
    parse_json_field(&mut obj, "fields");
    Ok(Json(Value::Object(obj)))
}
