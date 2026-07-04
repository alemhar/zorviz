// Server-side authentication for the shared HTTP API (D23).
// Verifies username + PIN with PBKDF2 (same params as apps/desktop/src/lib/crypto.ts)
// and issues opaque bearer session tokens held in memory.

use axum::{extract::State, http::HeaderMap, http::StatusCode, Json};
use pbkdf2::pbkdf2_hmac;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use sqlx::{Pool, Row, Sqlite};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

const PBKDF2_ITERS: u32 = 150_000;
const DK_LEN: usize = 32; // 256 bits
const SESSION_TTL_MS: i64 = 12 * 60 * 60 * 1000; // 12 hours
const MAX_ATTEMPTS: u32 = 5;
const LOCKOUT_MS: i64 = 30_000;

#[derive(Clone)]
pub struct Session {
    pub user_id: String,
    pub username: String,
    pub name: String,
    pub role: String,
    pub expires_at: i64,
}

#[derive(Default)]
pub struct AuthState {
    pub sessions: Mutex<HashMap<String, Session>>,
    pub attempts: Mutex<HashMap<String, (u32, i64)>>, // username -> (fail_count, locked_until_ms)
}

/// Shared axum state: the SQLite pool + auth/session store.
#[derive(Clone)]
pub struct ApiState {
    pub pool: Pool<Sqlite>,
    pub auth: Arc<AuthState>,
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// Hash a PIN with a fresh random salt (same PBKDF2 params as verify). Returns (hash_hex, salt_hex).
pub fn hash_pin(pin: &str) -> (String, String) {
    let mut salt = [0u8; 16];
    rand::RngCore::fill_bytes(&mut rand::rngs::OsRng, &mut salt);
    let mut out = [0u8; DK_LEN];
    pbkdf2_hmac::<Sha256>(pin.as_bytes(), &salt, PBKDF2_ITERS, &mut out);
    (hex::encode(out), hex::encode(salt))
}

fn verify_pin(pin: &str, hash_hex: &str, salt_hex: &str) -> bool {
    let (salt, expected) = match (hex::decode(salt_hex), hex::decode(hash_hex)) {
        (Ok(s), Ok(h)) => (s, h),
        _ => return false,
    };
    let mut derived = [0u8; DK_LEN];
    pbkdf2_hmac::<Sha256>(pin.as_bytes(), &salt, PBKDF2_ITERS, &mut derived);
    constant_time_eq(&derived, &expected)
}

#[derive(Deserialize)]
pub struct LoginReq {
    username: String,
    pin: String,
}

#[derive(Serialize, Clone)]
pub struct UserDto {
    id: String,
    name: String,
    username: String,
    role: String,
}

#[derive(Serialize)]
pub struct LoginRes {
    token: String,
    user: UserDto,
}

pub async fn login(
    State(state): State<ApiState>,
    Json(req): Json<LoginReq>,
) -> Result<Json<LoginRes>, (StatusCode, String)> {
    let username = req.username.trim().to_string();
    let now = now_ms();

    // Lockout check
    {
        let attempts = state.auth.attempts.lock().unwrap();
        if let Some((count, locked_until)) = attempts.get(&username) {
            if *count >= MAX_ATTEMPTS && now < *locked_until {
                let secs = (*locked_until - now) / 1000 + 1;
                return Err((
                    StatusCode::TOO_MANY_REQUESTS,
                    format!("Too many attempts. Try again in {}s.", secs),
                ));
            }
        }
    }

    let row = sqlx::query(
        "SELECT id, name, username, pin_hash, pin_salt, role, is_active FROM users WHERE username = ? LIMIT 1",
    )
    .bind(&username)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let verified: Option<UserDto> = row.and_then(|r| {
        let is_active: i64 = r.try_get("is_active").unwrap_or(0);
        if is_active != 1 {
            return None;
        }
        let hash: String = r.try_get("pin_hash").ok()?;
        let salt: String = r.try_get("pin_salt").ok()?;
        if verify_pin(&req.pin, &hash, &salt) {
            Some(UserDto {
                id: r.try_get("id").ok()?,
                name: r.try_get("name").ok()?,
                username: r.try_get("username").ok()?,
                role: r.try_get("role").ok()?,
            })
        } else {
            None
        }
    });

    match verified {
        Some(user) => {
            state.auth.attempts.lock().unwrap().remove(&username);
            let token = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
            let session = Session {
                user_id: user.id.clone(),
                username: user.username.clone(),
                name: user.name.clone(),
                role: user.role.clone(),
                expires_at: now + SESSION_TTL_MS,
            };
            state
                .auth
                .sessions
                .lock()
                .unwrap()
                .insert(token.clone(), session);
            Ok(Json(LoginRes { token, user }))
        }
        None => {
            let mut attempts = state.auth.attempts.lock().unwrap();
            let entry = attempts.entry(username).or_insert((0, 0));
            entry.0 += 1;
            if entry.0 >= MAX_ATTEMPTS {
                entry.1 = now + LOCKOUT_MS;
            }
            Err((StatusCode::UNAUTHORIZED, "Invalid username or PIN.".to_string()))
        }
    }
}

/// Resolve the active session from an `Authorization: Bearer <token>` header.
pub fn session_from_headers(state: &ApiState, headers: &HeaderMap) -> Option<Session> {
    let raw = headers.get("authorization")?.to_str().ok()?;
    let token = raw.strip_prefix("Bearer ")?;
    let now = now_ms();
    let mut sessions = state.auth.sessions.lock().unwrap();
    let session = sessions.get(token)?.clone();
    if session.expires_at < now {
        sessions.remove(token);
        return None;
    }
    Some(session)
}

pub async fn me(
    State(state): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<UserDto>, StatusCode> {
    match session_from_headers(&state, &headers) {
        Some(s) => Ok(Json(UserDto {
            id: s.user_id,
            name: s.name,
            username: s.username,
            role: s.role,
        })),
        None => Err(StatusCode::UNAUTHORIZED),
    }
}

pub async fn logout(State(state): State<ApiState>, headers: HeaderMap) -> StatusCode {
    if let Some(raw) = headers.get("authorization").and_then(|v| v.to_str().ok()) {
        if let Some(token) = raw.strip_prefix("Bearer ") {
            state.auth.sessions.lock().unwrap().remove(token);
        }
    }
    StatusCode::NO_CONTENT
}
