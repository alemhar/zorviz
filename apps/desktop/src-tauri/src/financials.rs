// Financial layer (BACK-3-010/011): expenses log + cash-drawer sessions.
// Money-out tracking feeds the profit picture; drawer sessions surface over/short
// (leakage) — both sync to the cloud for the owner's remote dashboard.

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;

use crate::api_data::{now_ms, require_admin, require_staff, row_to_json};
use crate::auth::{session_from_headers, ApiState};

const CATEGORIES: [&str; 5] = ["parts", "salary", "utilities", "rent", "misc"];

// ---- Expenses (BACK-3-010) ----

/// GET /api/expenses — recent expenses, newest first (voided included, flagged). Staff only.
pub async fn list_expenses(
    State(state): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<Value>, StatusCode> {
    require_staff(&state, &headers)?;
    let rows = sqlx::query("SELECT * FROM expenses ORDER BY created_at DESC LIMIT 200")
        .fetch_all(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(Value::Array(rows.iter().map(|r| Value::Object(row_to_json(r))).collect())))
}

#[derive(Deserialize)]
pub struct CreateExpenseReq {
    category: String,
    amount: i64, // centavos
    note: Option<String>,
    #[serde(default = "default_true")]
    paid_from_drawer: bool,
}
fn default_true() -> bool {
    true
}

/// POST /api/expenses — record money out. Staff only; the log is immutable (void, don't delete).
pub async fn create_expense(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(req): Json<CreateExpenseReq>,
) -> Result<Json<Value>, (StatusCode, String)> {
    require_staff(&state, &headers).map_err(|s| (s, "staff only".to_string()))?;
    let category = req.category.trim().to_lowercase();
    if !CATEGORIES.contains(&category.as_str()) {
        return Err((StatusCode::BAD_REQUEST, "unknown expense category".to_string()));
    }
    if req.amount <= 0 {
        return Err((StatusCode::BAD_REQUEST, "the amount must be greater than zero".to_string()));
    }
    let author = session_from_headers(&state, &headers).map(|s| s.name);
    let note = req.note.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let id = uuid::Uuid::new_v4().to_string();
    let now = now_ms();
    sqlx::query(
        "INSERT INTO expenses (id, category, amount, note, paid_from_drawer, author, voided, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)",
    )
    .bind(&id)
    .bind(&category)
    .bind(req.amount)
    .bind(&note)
    .bind(if req.paid_from_drawer { 1_i64 } else { 0_i64 })
    .bind(&author)
    .bind(now)
    .bind(now)
    .execute(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "could not record the expense".to_string()))?;

    let row = sqlx::query("SELECT * FROM expenses WHERE id = ? LIMIT 1")
        .bind(&id)
        .fetch_one(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "read failed".to_string()))?;
    Ok(Json(Value::Object(row_to_json(&row))))
}

/// POST /api/expenses/:id/void — soft-void a mistaken entry (admin/owner only; nothing is deleted).
pub async fn void_expense(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    require_admin(&state, &headers).map_err(|s| (s, "admin only".to_string()))?;
    let actor = session_from_headers(&state, &headers).map(|s| s.name);
    let result = sqlx::query("UPDATE expenses SET voided = 1, voided_by = ?, updated_at = ? WHERE id = ? AND voided = 0")
        .bind(&actor)
        .bind(now_ms())
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "void failed".to_string()))?;
    if result.rows_affected() == 0 {
        return Err((StatusCode::CONFLICT, "expense not found or already voided".to_string()));
    }
    let row = sqlx::query("SELECT * FROM expenses WHERE id = ? LIMIT 1")
        .bind(&id)
        .fetch_one(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "read failed".to_string()))?;
    Ok(Json(Value::Object(row_to_json(&row))))
}

// ---- Drawer sessions (BACK-3-011) ----

/// GET /api/drawer — the open session (if any) + the most recent closed one. Staff only.
pub async fn drawer_status(
    State(state): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<Value>, StatusCode> {
    require_staff(&state, &headers)?;
    let open = sqlx::query("SELECT * FROM drawer_sessions WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1")
        .fetch_optional(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .map(|r| Value::Object(row_to_json(&r)))
        .unwrap_or(Value::Null);
    let last_closed = sqlx::query("SELECT * FROM drawer_sessions WHERE closed_at IS NOT NULL ORDER BY closed_at DESC LIMIT 1")
        .fetch_optional(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .map(|r| Value::Object(row_to_json(&r)))
        .unwrap_or(Value::Null);
    Ok(Json(json!({ "open": open, "last_closed": last_closed })))
}

#[derive(Deserialize)]
pub struct OpenDrawerReq {
    opening_float: i64, // centavos
}

/// POST /api/drawer/open — start the day: record the float. One open session at a time. Staff only.
pub async fn open_drawer(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(req): Json<OpenDrawerReq>,
) -> Result<Json<Value>, (StatusCode, String)> {
    require_staff(&state, &headers).map_err(|s| (s, "staff only".to_string()))?;
    if req.opening_float < 0 {
        return Err((StatusCode::BAD_REQUEST, "the opening float can't be negative".to_string()));
    }
    let already_open: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM drawer_sessions WHERE closed_at IS NULL")
        .fetch_one(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "query failed".to_string()))?;
    if already_open > 0 {
        return Err((StatusCode::CONFLICT, "The drawer is already open — close it first.".to_string()));
    }
    let opened_by = session_from_headers(&state, &headers).map(|s| s.name);
    let id = uuid::Uuid::new_v4().to_string();
    let now = now_ms();
    sqlx::query(
        "INSERT INTO drawer_sessions (id, opening_float, opened_by, opened_at, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(req.opening_float)
    .bind(&opened_by)
    .bind(now)
    .bind(now)
    .bind(now)
    .execute(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "could not open the drawer".to_string()))?;
    let row = sqlx::query("SELECT * FROM drawer_sessions WHERE id = ? LIMIT 1")
        .bind(&id)
        .fetch_one(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "read failed".to_string()))?;
    Ok(Json(Value::Object(row_to_json(&row))))
}

#[derive(Deserialize)]
pub struct CloseDrawerReq {
    counted_cash: i64, // centavos actually in the drawer
}

/// POST /api/drawer/close — end the day: expected = float + cash payments − drawer-paid expenses
/// (within the session window); records counted cash and the over/short. Staff only.
pub async fn close_drawer(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(req): Json<CloseDrawerReq>,
) -> Result<Json<Value>, (StatusCode, String)> {
    require_staff(&state, &headers).map_err(|s| (s, "staff only".to_string()))?;
    if req.counted_cash < 0 {
        return Err((StatusCode::BAD_REQUEST, "the counted cash can't be negative".to_string()));
    }
    let open = sqlx::query("SELECT id, opening_float, opened_at FROM drawer_sessions WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1")
        .fetch_optional(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "query failed".to_string()))?
        .ok_or((StatusCode::CONFLICT, "No open drawer session — open the day first.".to_string()))?;
    let session_id: String = open.try_get("id").map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "read failed".to_string()))?;
    let opening_float: i64 = open.try_get("opening_float").unwrap_or(0);
    let opened_at: i64 = open.try_get("opened_at").unwrap_or(0);

    let cash_in: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE method = 'cash' AND created_at >= ?",
    )
    .bind(opened_at)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "query failed".to_string()))?;

    let cash_out: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE paid_from_drawer = 1 AND voided = 0 AND created_at >= ?",
    )
    .bind(opened_at)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "query failed".to_string()))?;

    let expected = opening_float + cash_in - cash_out;
    let over_short = req.counted_cash - expected; // negative = short
    let closed_by = session_from_headers(&state, &headers).map(|s| s.name);
    let now = now_ms();
    sqlx::query(
        "UPDATE drawer_sessions SET expected_cash = ?, counted_cash = ?, over_short = ?, \
         closed_by = ?, closed_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(expected)
    .bind(req.counted_cash)
    .bind(over_short)
    .bind(&closed_by)
    .bind(now)
    .bind(now)
    .bind(&session_id)
    .execute(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "could not close the drawer".to_string()))?;

    let row = sqlx::query("SELECT * FROM drawer_sessions WHERE id = ? LIMIT 1")
        .bind(&session_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "read failed".to_string()))?;
    Ok(Json(Value::Object(row_to_json(&row))))
}
