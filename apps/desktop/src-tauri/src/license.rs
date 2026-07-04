// Offline license verification (D17): Ed25519-signed license files bound to device fingerprints.
// The app embeds the owner's PUBLIC key; the owner keeps the private key and signs licenses with
// the `licensegen` bin. Trial handling + UI gating are a later increment.

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::Path;

// Owner's public key (base64 of the 32-byte Ed25519 verifying key).
// DEV KEY — the owner MUST regenerate a keypair (`licensegen keygen`), keep the private key
// secret, and replace this with their public key for production builds.
pub const EMBEDDED_PUBLIC_KEY_B64: &str = "znwE5huw4Ns+DjRgdBPVG/oJYhWl13T7g2TRzwD2kOE=";

const LICENSE_FILE: &str = "license.json";

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

#[derive(Serialize, Deserialize, Clone)]
pub struct LicensePayload {
    pub license_id: String,
    pub shop_name: String,
    #[serde(default)]
    pub devices: Vec<String>, // allowed device fingerprints
    #[serde(default)]
    pub modules: Vec<String>,
    pub expires: Option<i64>, // ms epoch; None = perpetual
    pub issued_at: i64,
}

#[derive(Serialize, Deserialize)]
pub struct LicenseFile {
    pub data: String, // base64 of the payload JSON bytes (signed verbatim)
    pub sig: String,  // base64 of the Ed25519 signature over those bytes
}

// Self-start trial + grace windows (D21). Read-only after grace — never destructive (D24).
const TRIAL_DAYS: i64 = 90; // ~3 months
const GRACE_DAYS: i64 = 3;
const DAY_MS: i64 = 86_400_000;
const TRIAL_FILE: &str = "trial.json";

#[derive(Serialize)]
pub struct LicenseStatus {
    pub state: String,  // valid | trial | grace | expired | trial_expired | wrong_device | invalid
    pub access: String, // full | readonly
    pub device_code: String,
    pub shop_name: Option<String>,
    pub modules: Vec<String>,
    pub expires: Option<i64>,
    pub trial_ends: Option<i64>,
    pub message: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct TrialMarker {
    started_at: i64,
}

/// Stable per-device code (short) derived from the OS machine id.
pub fn device_fingerprint() -> String {
    let raw = machine_uid::get().unwrap_or_else(|_| "unknown-device".to_string());
    let mut h = Sha256::new();
    h.update(raw.as_bytes());
    hex::encode(&h.finalize()[..8]) // 16 hex chars
}

// ---- Owner-side (licensegen) ----

pub fn generate_keypair() -> (String, String) {
    let sk = SigningKey::generate(&mut OsRng);
    let vk = sk.verifying_key();
    (B64.encode(sk.to_bytes()), B64.encode(vk.to_bytes()))
}

pub fn sign_license(payload: &LicensePayload, priv_b64: &str) -> Result<String, String> {
    let sk_bytes = B64.decode(priv_b64).map_err(|e| e.to_string())?;
    let sk_arr: [u8; 32] = sk_bytes.as_slice().try_into().map_err(|_| "bad private key length".to_string())?;
    let sk = SigningKey::from_bytes(&sk_arr);
    let data = serde_json::to_vec(payload).map_err(|e| e.to_string())?;
    let sig = sk.sign(&data);
    let file = LicenseFile {
        data: B64.encode(&data),
        sig: B64.encode(sig.to_bytes()),
    };
    serde_json::to_string_pretty(&file).map_err(|e| e.to_string())
}

// ---- App-side verification ----

// Verify the file signature and decode the payload. Err(reason) if malformed/forged.
fn verify_payload(content: &str) -> Result<LicensePayload, String> {
    // Tolerate a UTF-8 BOM / surrounding whitespace (files saved by some editors).
    let content = content.trim_start_matches('\u{feff}').trim();
    let file: LicenseFile = serde_json::from_str(content).map_err(|_| "Malformed license file".to_string())?;
    let data = B64.decode(&file.data).map_err(|_| "Bad license encoding".to_string())?;
    let sig_bytes = B64.decode(&file.sig).map_err(|_| "Bad signature encoding".to_string())?;
    let vk_bytes = B64.decode(EMBEDDED_PUBLIC_KEY_B64).map_err(|_| "Bad embedded key".to_string())?;
    let vk_arr: [u8; 32] = vk_bytes.as_slice().try_into().map_err(|_| "Bad embedded key".to_string())?;
    let vk = VerifyingKey::from_bytes(&vk_arr).map_err(|_| "Bad embedded key".to_string())?;
    let sig_arr: [u8; 64] = sig_bytes.as_slice().try_into().map_err(|_| "Bad signature".to_string())?;
    let sig = Signature::from_bytes(&sig_arr);
    vk.verify(&data, &sig).map_err(|_| "Signature verification failed".to_string())?;
    serde_json::from_slice(&data).map_err(|_| "Bad payload".to_string())
}

fn read_or_start_trial(data_dir: &Path, now: i64) -> i64 {
    let path = data_dir.join(TRIAL_FILE);
    if let Ok(s) = std::fs::read_to_string(&path) {
        if let Ok(m) = serde_json::from_str::<TrialMarker>(&s) {
            return m.started_at;
        }
    }
    let _ = std::fs::create_dir_all(data_dir);
    let _ = std::fs::write(&path, serde_json::to_string(&TrialMarker { started_at: now }).unwrap_or_default());
    now
}

fn mk(
    state: &str,
    access: &str,
    fp: &str,
    shop: Option<String>,
    modules: Vec<String>,
    expires: Option<i64>,
    trial_ends: Option<i64>,
    msg: Option<String>,
) -> LicenseStatus {
    LicenseStatus {
        state: state.to_string(),
        access: access.to_string(),
        device_code: fp.to_string(),
        shop_name: shop,
        modules,
        expires,
        trial_ends,
        message: msg,
    }
}

pub fn read_license_status(data_dir: &Path) -> LicenseStatus {
    let fp = device_fingerprint();
    let now = now_ms();

    // A present license file takes precedence over the trial.
    if let Ok(content) = std::fs::read_to_string(data_dir.join(LICENSE_FILE)) {
        match verify_payload(&content) {
            Err(reason) => return mk("invalid", "readonly", &fp, None, vec![], None, None, Some(reason)),
            Ok(p) => {
                if !p.devices.is_empty() && !p.devices.contains(&fp) {
                    return mk("wrong_device", "readonly", &fp, Some(p.shop_name), p.modules, p.expires, None,
                        Some("License is not valid for this device".to_string()));
                }
                let (state, access, msg) = match p.expires {
                    None => ("valid", "full", None),
                    Some(exp) if now <= exp => ("valid", "full", None),
                    Some(exp) if now <= exp + GRACE_DAYS * DAY_MS => {
                        ("grace", "full", Some("License expired — please renew (grace period)".to_string()))
                    }
                    Some(_) => ("expired", "readonly", Some("License expired — renew to continue editing".to_string())),
                };
                return mk(state, access, &fp, Some(p.shop_name), p.modules, p.expires, None, msg);
            }
        }
    }

    // No license → self-start trial (never blocks a fresh install).
    let start = read_or_start_trial(data_dir, now);
    let trial_end = start + TRIAL_DAYS * DAY_MS;
    let (state, access, msg) = if now <= trial_end {
        let days = ((trial_end - now) / DAY_MS) + 1;
        ("trial", "full", Some(format!("Trial — {} day(s) left", days)))
    } else if now <= trial_end + GRACE_DAYS * DAY_MS {
        ("grace", "full", Some("Trial ended — purchase to continue (grace period)".to_string()))
    } else {
        ("trial_expired", "readonly", Some("Trial ended — enter a license to continue editing".to_string()))
    };
    mk(state, access, &fp, None, vec![], None, Some(trial_end), msg)
}

pub fn write_license(data_dir: &Path, content: &str) -> Result<(), String> {
    std::fs::create_dir_all(data_dir).map_err(|e| e.to_string())?;
    std::fs::write(data_dir.join(LICENSE_FILE), content).map_err(|e| e.to_string())
}
