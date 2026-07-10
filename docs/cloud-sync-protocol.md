# Cloud Sync Protocol (v2.1 — LOCKED; v1 2026-07-08, v1.1/v1.2 2026-07-09, v2 pull + v2.1 booking inbox 2026-07-10)

> **Status:** LOCKED v1 (decisions in §9 confirmed) — implementation in progress, backend parked.
> This is the single contract both sides build
> against: the **desktop (Commander)** implements the client; the **cloud backend** implements the
> receiver to match. Client-first / contract-first — the local SQLite is the source of truth; the
> cloud is an optional mirror/backup (Plan §Sync-is-a-Feature).
>
> Defaults below are **recommendations** — override any before we implement.

---

## 1. Principles

- **Local-first, fail-safe.** The app runs fully offline. Sync is opt-in (`app_config.sync_enabled`)
  and any sync failure is caught + backed off — it never blocks or corrupts local operation.
- **One Commander per shop (v1).** A shop = one desktop install = one `tenant_id`. No multi-writer
  conflicts in v1, so **push-only** (backup) is the MVP. Pull / multi-device is reserved (§8).
- **The client owns the contract.** The backend conforms to this document.

## 2. Identity & auth

- `tenant_id` — unique UUID per install (in `app_config`, generated at setup). Identifies the shop.
- `device_token` — opaque bearer token issued by the cloud when the owner registers the device
  (BACK-4-005). Stored in `app_config.device_token`.
- Every request: `Authorization: Bearer <device_token>`. The backend resolves **token → tenant_id**
  server-side and scopes all data to that tenant. **The server never trusts a client-supplied
  `tenant_id`** for authorization (it's sent only for sanity/logging).
- Rejected/absent token → `401`; token valid but revoked/mismatched tenant → `403`.

## 3. Transport

- HTTPS (TLS) only. Base URL from `app_config.cloud_url` (no trailing slash).
- `Content-Type: application/json`. Bodies are UTF-8 JSON.
- **Encryption at rest / app-layer diff encryption (BACK-4-008): RESERVED.** v1 relies on TLS in
  transit; a future version may wrap `changes` in an owner-held-key envelope. Versioned via §7.

## 4. Endpoints

### `GET /health`
Liveness + auth probe. Used by the desktop's status pill.
- `200 {"ok": true, "server_time": <epoch_ms>}` → status "Connected".
- `401`/`403` → "Device token rejected". Any other/unreachable → "Can't reach cloud backend".

### `POST /sync/push`  (v1 core)
Uploads local changes since the last watermark. **Idempotent** — safe to resend the same batch
(backend upserts by primary key).

Request:
```jsonc
{
  "protocol_version": 1,
  "tenant_id": "a20b7cf1-…",       // sanity only; auth is the token
  "device_name": "Main PC",
  "since": 0,                        // client's last_synced_at (epoch ms); 0 = full initial push
  "sent_at": 1751990000000,
  "changes": {                       // only tables with rows changed since `since`
    "customers":   [ { …row… }, … ],
    "assets":      [ … ],
    "asset_types": [ … ],
    "bookings":    [ … ],
    "orders":      [ … ],
    "order_items": [ … ],
    "inventory":   [ … ],
    "inventory_adjustments": [ … ],
    "payments":    [ … ],
    "expenses":        [ … ],
    "drawer_sessions": [ … ],
    "order_status_history": [ … ],
    "drawer_movements": [ … ]
  }
}
```
- Rows are the **full row** as stored locally (snake_case columns, money in centavos, timestamps in
  epoch ms), each carrying its primary key `id`. Backend **upserts by `id`** into the tenant's rows.
- Soft-deletes propagate via the existing `deleted_at` column (e.g. assets); no hard deletes in v1.
- Tables **excluded from v1 sync:** `users` (local auth; synced later with care), `app_config`
  (device-local settings incl. the cloud-link config + watermark itself), and **media** (photos are
  files under `media/`; `order_photos`/`photo_notes` metadata + file blobs are deferred to §8).
- `asset_types` **is** synced (small, shop-defined config; already has `updated_at`).

Response:
```jsonc
{
  "ok": true,
  "watermark": 1751990000000,   // new last_synced_at the client should store (backend's sent_at)
  "accepted": { "customers": 3, "orders": 1, … },  // counts, for status/telemetry
  "protocol_version": 1
}
```
- On `200` the client stores `watermark` in `app_config.last_synced_at`.
- Partial failure is **all-or-nothing per request** (backend applies the batch in a transaction);
  on any error the client keeps its old watermark and retries the same window later.

### `POST /sync/pull`  (superseded — v2 defines the pull as §10 Recovery, one-shot snapshot only)
Reserved for multi-device / portal write-back. Shape TBD when we build bidirectional sync (§8).

## 5. Watermark & change tracking

- Client keeps `app_config.last_synced_at` (epoch ms; 0 initially).
- A push sends every synced-table row with `updated_at > since` (append-only tables use `created_at`).
- On success, `last_synced_at := response.watermark` (the backend's `sent_at`, so clock skew is the
  backend's single clock, not the device's).
- **Schema prerequisite (migration lands first — audited 2026-07-08):** every synced table needs a
  monotonic change marker.
  - `inventory` — **no timestamps**; add `created_at` + `updated_at`, touched on every write
    (create/edit, stock adjustment, and auto deduct/restock on approval/cancel).
  - `order_items` — **no timestamps**; add `created_at` + `updated_at`, set on insert (estimate save
    re-creates them) and bumped on the `completed` toggle.
  - Append-only, `created_at` is the marker (no change needed): `payments`, `inventory_adjustments`.
  - **Added 2026-07-08 (BACK-3-010..013, still protocol v1 — additive):** `expenses` and
    `drawer_sessions` sync with `updated_at` markers (soft-void / close bump them);
    `order_items` gains `cost_at_sale`; `orders` gains `created_by`/`cancelled_by`/`discounted_by`;
    `payments.amount` is now the **per-payment** amount (multiple payments per order — partials);
    upsert-by-id semantics unchanged. `order_status_history` (0022) also syncs — append-only
    movement log, `created_at` marker. **0023 (BACK-3-016/017, additive):** `inventory_adjustments`
    gains `expense_id`/`total_cost`/`on_account`; new `drawer_movements` table syncs append-only
    (`created_at` marker).
  - Already have `updated_at` (no change): `orders`, `customers`, `assets`, `asset_types`, `bookings`.
  - `app_config` gains `last_synced_at` (the client watermark).
  - **v1.1 (2026-07-09, additive — desktop 0024/0025/0026 master data + partial settlement):**
    - `expenses` gains `receive_id` — a payment against an on-account receive (partials allowed).
      **Breaking semantics note:** settlement no longer writes `inventory_adjustments.expense_id`;
      the outstanding payable balance is `total_cost − SUM(unvoided expenses with receive_id = a.id)`
      (a voided payment reopens the payable). Cloud consumers computing payables MUST use the
      balance formula, not `expense_id IS NULL` alone.
    - `inventory_adjustments` gains `supplier` (denormalized display name) + `supplier_id`.
    - `customers` gains `notes` (staff-facing).
    - New table 14: **`suppliers`** (`id`, `name`, `contact_person`, `phone`, `address`, `notes`,
      `created_at`, `updated_at`) — `updated_at` marker, upsert by (tenant_id, id). Desktop ids
      may be 32-char hex (migration backfill) rather than strict UUID.
  - **v1.2 (2026-07-09, additive — BACK-4-009 cloud analytics prerequisite):** new
    `shop_settings` payload — a single **curated** row projected from `app_config`
    (`id`, `shop_name`, `currency_symbol`, `tax_rate`, `vat_status`, `tax_inclusive`,
    `max_discount_pct`, `updated_at`; `updated_at` marker). Explicit column list — **secrets
    (`device_token`, `cloud_url`) and local-only fields never leave the shop.** Gives the cloud
    correct money formatting and policy context (e.g. discount-cap breach detection). Clouds on
    v1.1 ignore the unknown table (additive-safe).
    Also new: **`staff_directory`** — curated projection of `users` (`id`, `name`, `username`,
    `role`, `is_active`, `email`, `updated_at`; `updated_at` marker) so per-staff analytics can
    show names, and so recovery (§10) restores complete accounts. **Secrets never sync:** no
    `pin_hash`/`pin_salt` in either direction. (2026-07-10: owner widened the projection to
    include `username`/`email` for restore completeness — originally username was held local.)
    The `users` table itself remains excluded from sync.
    **Deployment note (both v1.2 payloads):** a device that pushed past its watermark before the
    cloud accepts these tables won't resend them until the row changes — after deploying the
    cloud side, either bump each shop's settings/users once or reset the device watermark to 0
    (idempotent full re-push heals it).

## 6. Trigger cadence (client)

- On `/health` → Connected: run one push.
- Then periodic push (default **every 60s** while connected) + a **debounced push ~5s after any
  local mutation**.
- All within the existing fail-safe lifecycle (backoff on error; never blocks the UI).
- A manual **"Sync now"** action in Settings.

## 7. Versioning & errors

- `protocol_version` in every request/response. Backend rejects unknown major versions with `409`
  and a `{ "min_supported": N }` hint so the desktop can prompt an update.
- Error envelope: `{ "ok": false, "error": "<machine_code>", "message": "<human>" }`.
- Standard codes: `401` no/invalid token · `403` revoked/tenant mismatch · `409` protocol mismatch ·
  `422` malformed batch · `5xx` server → client backs off and retries.

## 8. Reserved for later (explicitly not v1)

- **Pull / bidirectional sync** and conflict resolution (the `resolver` in `packages/sync-engine`).
- **Media/file sync** (ticket photos, logo) — likely presigned-URL uploads, separate from row sync.
- **App-layer encryption** of `changes` (BACK-4-008), key management, owner-held keys.
- **Users/app_config sync** — sensitive; deferred with an explicit policy.

## 9. Decisions (confirmed 2026-07-08)

1. **Direction:** ✅ push-only backup for v1 (pull/bidirectional reserved, §8).
2. **Change tracking:** ✅ watermark via `updated_at`/`created_at` (schema migration per §5 lands first).
3. **Encryption:** ✅ TLS-only for v1; app-layer diff encryption reserved (BACK-4-008).
4. **`asset_types`:** ✅ included in sync.
5. **`users` sync:** ✅ deferred for v1.

---

## 10. Protocol v2 — Recovery Pull (LOCKED 2026-07-10)

> **Purpose:** disaster recovery (BACK-4-016 "Cloud Restore"). A shop's PC is gone; a fresh
> Wurkz Shop install pulls the tenant's full data set back down, once. This section is the
> whole of v2 — **push semantics (§4–§6) are unchanged.**

### 10.1 Non-goals (explicit)

- **NOT two-way / continuous sync.** No merge, no conflict resolution, no multi-device write.
- **NOT partial or point-in-time restore.** The cloud holds latest-state only; the snapshot is
  all-or-nothing. (PITR reserved as a possible later premium tier.)
- **NOT a migration/export API.** Same tables, same whitelists as push — nothing extra leaves.

### 10.2 Recovery authentication (revised 2026-07-10 — rides the existing connect flow)

No separate recovery credential. Recovery reuses the **device token** flow that already
gates cloud connection: on disaster day the owner contacts the platform (same as onboarding —
the human contact IS the identity check) and receives a fresh token.

- **Admin panel gains "Issue replacement token"**: creates the new device token AND revokes
  all prior tokens for the tenant in the same click — the lost/stolen PC's token dies the
  moment the shop recovers elsewhere. (Normal "issue token" remains for adding devices;
  replacement is the disaster-day button.)
- Token issuance/revocation is audit-logged. Nothing else new to operate.
- Owner-self-serve issuance from Wurkz Cloud may be added later without a protocol change.

### 10.3 Endpoints

No claim endpoint — the wizard connects exactly like the Settings cloud-link flow (URL +
device token, `GET /health` proves it), then:

**`GET /sync/tenant-info`** (Bearer device token)
→ `200`: `{ "protocol_version": 2, "tenant_id": "…", "shop_name": "…", "has_data": true }`
Lets the wizard show "Restore NP Car Aircon Repair?" before pulling, and lets a fresh tenant
skip straight to normal setup. (The desktop needs `tenant_id` to write into `app_config` so
future pushes continue the same cloud tenant.)

**`GET /sync/snapshot`** (Bearer device token)
→ `200`:
```json
{
  "protocol_version": 2,
  "snapshot_at": 1783600000000,
  "tables": { "customers": [ … ], …, "shop_settings": [ … ], "staff_directory": [ … ] }
}
```
- Contents: exactly the v1.2 table/column whitelists (§4/§5) — the same shapes push sends,
  minus `tenant_id` (implied by the token). Nothing beyond the whitelists is ever returned.
- Single gzip response. Shop datasets are MB-scale; chunking is reserved (a future `?table=`
  filter) and NOT part of v2.
- Repeatable: `GET` is read-only and may be retried freely while the token is valid.

### 10.4 Desktop restore semantics

1. Setup wizard offers **"I already use Wurkz — restore from the cloud"** beside fresh setup —
   available ONLY while the local database is empty (setup not completed). **Never merges**
   into an existing shop; a used database refuses recovery. (Free bonus scenario: planned PC
   upgrades use the same path while the old PC still works.)
2. Order of operations: run local migrations to latest → connect (URL + token, `/health`) →
   `tenant-info` (confirm shop identity on screen) → `snapshot` → **write all
   rows in one transaction** (an interrupted restore rolls back to a clean, retryable slate)
   → write `app_config` (original `tenant_id` from `tenant-info` — REQUIRED so future pushes
   continue the same cloud tenant; `cloud_url`, `device_token`, `sync_enabled=1`,
   `last_synced_at = snapshot_at` so push resumes without a full resend) → apply
   `shop_settings` row into `app_config` fields.
3. Deterministic insert order (parent-before-child):
   `customers → asset_types → assets → bookings → orders → order_items →
   order_status_history → payments → suppliers → inventory → inventory_adjustments →
   expenses → drawer_sessions → drawer_movements`.
4. **Staff re-entry (revised 2026-07-10):** `staff_directory` rows recreate local users
   COMPLETE — id, name, username, role, is_active, email — with **no PINs** (hashes never sync
   in either direction). The wizard's final step: "pick your account, set a new PIN" — listing
   the restored admin/owner-role accounts (the verified replacement token entitles the holder).
   That person then resets the other staff PINs from the existing Staff page. No accounts are
   created on restore — only re-keyed. (Context: fresh installation creates exactly ONE account,
   role 'admin' — there is no separate owner account at install.)
5. **Honesty screen:** before finishing, the wizard lists what did NOT come back — shop logo
   file, license activation, device/QR pairings, staff PINs, **job photos** (media never syncs
   in v1 — added to the list during Part 1 implementation) — with one-line fixes.
6. **License (decided 2026-07-10, as-is):** license state is machine-local and does not
   restore; the recovered shop runs in trial mode (nothing blocked) and the license is
   re-issued via platform contact — operationally the same call as the replacement token.
   The honesty screen says so: "Your license: contact us for a free re-issue — your shop runs
   on trial meanwhile." No cloud/license coupling.

### 10.5 Watermark & resume

`last_synced_at = snapshot_at` (server clock, from the response). Every restored row's change
marker ≤ `snapshot_at`, so the next push sends only genuinely new local changes. No full
re-push after recovery.

### 10.6 Subscription gate & retention

- `snapshot` requires an **active subscription** on the tenant → otherwise `402`
  with a human message ("Reactivate to recover — your data is safe"). The gate is deliberate:
  it is the renewal trigger.
- **Goodwill escape hatch (owner decision 2026-07-10):** for a LAPSED former cloud subscriber,
  the platform admin may **manually pull/export the tenant's data** on request — a case-by-case
  admin-side action within the retention window, not a product feature and not promised in
  marketing. Only possible for tenants that actually subscribed (no subscription ever = no
  cloud copy exists at all).
- **Retention after lapse: 90 days** (CONFIRMED 2026-07-10; platform-admin tunable per
  tenant). Within it, reactivate-and-recover always works (and the manual pull is possible).
  After it, data is eligible for deletion per the retention policy; deletion is manual in the
  manual-subscription era, never silent-automatic.
- **Pre-deletion warning:** as the window closes, the lapsed tenant gets one notice (email +
  SMS if a number is on file): "Your Wurkz Cloud backup will be deleted on [date]. Reactivate
  to keep it." Fairness + documented notice + the highest-value renewal prompt we send.
- Stated openly in the product: this is the honest churn lever, not a surprise.

### 10.7 Versioning & errors

- `protocol_version: 2` on the new endpoints only. Push keeps reporting `1` — v2 is additive;
  a v1.2 desktop pushes to a v2 cloud unchanged.
- Snapshot tables the desktop doesn't recognize are ignored (forward-compatible, mirrors the
  push rule); tables the desktop expects but the snapshot lacks restore as empty.
- Any non-200 leaves the local DB untouched (the transaction rule in 10.4).

## 11. v2 decisions (confirmed 2026-07-10)

1. **Pull = one-shot recovery snapshot only** ✅ (no two-way sync, no PITR, no partial).
2. **Recovery auth rides the existing device-token connect flow** ✅ (owner decision
   2026-07-10, replacing the earlier recovery-code design) — admin "Issue replacement token"
   revokes all prior tokens; new `tenant-info` endpoint identifies the shop pre-restore.
3. **Restore only into an empty install** ✅ — never a merge.
4. **PINs never travel; user details do** ✅ (revised 2026-07-10) — accounts restore complete
   incl. usernames; the wizard re-keys the recovering admin/owner, who re-keys the rest.
5. **Watermark = `snapshot_at`** ✅ — push resumes incrementally after recovery.
6. **Gate: active subscription; 90-day post-lapse retention (tunable), no silent deletion** ✅;
   lapsed ex-subscribers may get a manual admin-side data pull on request (goodwill, not a
   product feature) ✅.

---

## 12. Protocol v2.1 — Booking Inbox (LOCKED 2026-07-10)

> **Purpose:** deliver cloud-originated online bookings (BACK-4-017) to the desktop without
> breaking the one-writer-per-table rule. `bookings` stays desktop-owned and pushes up as
> always; `booking_requests` is a **cloud-owned queue** the desktop drains. Additive — push
> (§4–6) and recovery (§10) unchanged.

### 12.1 Model

Cloud table `booking_requests` (never synced as a table): `id`, `tenant_id`, `status`
(`pending` → `confirmed`/`declined`; `confirmed` → `delivered` → `materialized`),
`customer_name`, `customer_phone`, `customer_email?`, `asset_description`, `concern`,
`requested_time`, `confirmed_time?`, `decline_reason?`, `booking_id?` (set at materialization),
timestamps. Only `confirmed` requests ever reach the desktop.

### 12.2 Endpoints (device token auth, same as push)

**`GET /sync/booking-inbox`** → `200`:
```json
{ "protocol_version": 2, "requests": [ { "id": "…", "customer_name": "…",
  "customer_phone": "…", "customer_email": null, "asset_description": "…",
  "concern": "…", "confirmed_time": 1783700000000 } ] }
```
Returns requests in status `confirmed` only (not yet `delivered`). Read-only and repeatable.

**`POST /sync/booking-ack`**
```json
{ "ids": ["…"] }
```
→ marks them `delivered`. **Delivered-exactly-once contract:** the desktop creates local
bookings inside a transaction FIRST, then ACKs; if the ACK is lost, the next inbox fetch
returns the same requests and the desktop dedupes by request id (local `bookings` gains a
nullable `request_id` column — also added to the push whitelist so the cloud can mark
`materialized` and link `booking_id` when the booking pushes up).

### 12.3 Client behavior (desktop)

- Piggybacks on the existing 60s connected cycle: `booking-inbox` → create local bookings →
  `booking-ack`. Offline shops simply drain the queue on reconnect.
- **Amended 2026-07-10 (implementation):** materialization creates a LIGHTWEIGHT booking
  (customer_name/phone, note = asset · concern · email) and does NOT create a customers row —
  public-form input is not master data; the customer record is created at drop-off/convert,
  which the bookings flow already supports.
- UI: booking appears in the Bookings page flagged "online booking"; arrival toast.

### 12.4 Decisions (confirmed 2026-07-10)

1. **Confirmation lives on the cloud** ✅ — the shop PC being offline must never block
   confirming a customer; notifications (owner email/SMS, customer email/SMS post-confirm)
   are entirely cloud-side and outside this protocol.
2. **Queue + ACK with client-side dedupe by request id** ✅ (exactly-once materialization).
3. **`bookings.request_id`** joins the push whitelist ✅ (additive column, v1.2 rules apply).
4. **SMS provider** is a cloud implementation detail behind an interface (Semaphore first;
   ~₱0.50–0.56/SMS ex-VAT) — never part of the protocol.
