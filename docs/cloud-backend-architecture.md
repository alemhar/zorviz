# Cloud Backend Architecture — v1 (INTERIM: shared-hosting / Laravel)

> **Status:** LOCKED 2026-07-08 (decisions in §9 confirmed via discussion). **Interim by design** — chosen to fit the current **Hostinger shared
> hosting** (PHP + MySQL). If we later move to a VPS, this could be revisited (e.g. a Node/Next
> service sharing the TS `packages/core`); for now Laravel is the pragmatic, lowest-friction fit.
> Implements the already-locked [`cloud-sync-protocol.md`](./cloud-sync-protocol.md) — that JSON
> contract is language-agnostic, so the finished desktop client is unchanged.

---

## 1. Why Laravel + MySQL (and the trade-offs)

- **Constraint:** Hostinger **shared hosting** runs PHP + MySQL; it can't host a persistent Node
  server. Laravel is the mature framework for that environment.
- **Auth fits perfectly:** **Laravel Sanctum** gives us API bearer tokens (for desktop devices) AND
  session/token auth for humans (owner + platform admin) in one system — directly answering "one
  auth for desktop + cloud users."
- **Trade-offs (accepted):**
  - **No TS code-sharing.** The backend is PHP, so it can't import `packages/core`. Impact is small —
    the cloud is a **sync mirror + read-only KPI dashboards**; it mostly stores rows and runs queries,
    not business math. Any shared rule (should it ever be needed) is re-stated in PHP.
  - **Separate repo/toolchain.** Laravel (Composer/PHP) does **not** live in the TS Turborepo. It's a
    **separate repository** (e.g. `zorviz-cloud`). The only shared artifact is the sync-protocol doc.
  - **Shared-hosting limits:** no long-running workers/websockets, PHP request timeouts, cron is
    limited. **Fine for our design** — everything is request/response (desktop POSTs sync; dashboards
    read). No background daemons required for v1.
  - **TLS:** Hostinger provides free SSL for a domain/subdomain → the desktop's `cloud_url` is e.g.
    `https://api.<shop-domain>` or `https://<domain>/api`.

## 2. Principals & auth (Sanctum)

| Principal | Auth mechanism | Scope | Purpose |
|---|---|---|---|
| **Desktop device** (Commander) | Sanctum **personal access token** (bearer), issued at device registration | one `tenant_id` | sync API (`/health`, `/sync/push`) |
| **Shop owner** (human) | Sanctum **session** (email + password login, same-domain dashboard) | their tenant(s) | full KPI dashboard incl. money |
| **Shop admin** (human) | same session login; `tenant_user.role = admin` | their tenant(s) | operations dashboard (money gated, §5) |
| **Platform admin** (vendor) | same session login, global `role = platform_admin` | all tenants | manage suite, subscriptions, devices, kill-switch |

- **One `users` table** (cloud) with a global `role ∈ {platform_admin, user}` + a `tenant_user` pivot
  carrying a **per-shop role ∈ {owner, admin}** (a user may belong to several shops). Passwords
  hashed by Laravel (bcrypt/argon).
- **Humans use sessions** (Sanctum SPA mode — dashboard and API are one app on one domain).
  **A token API for a future mobile app is additive later** — Sanctum runs both side-by-side, so
  nothing changes for the web dashboard when mobile arrives.
- **Devices** authenticate with a bearer token, never a session; middleware resolves either a device
  token or a human session into "who + which tenant(s)," and every query is tenant-scoped.
- **Desktop local auth stays separate.** The desktop's username+PIN users are local-first and are
  **not** federated to the cloud. Only owner/admin get cloud accounts (new cloud identities); the
  device links via its token.

## 3. Data model (MySQL)

**Platform tables**
- `tenants` — `id (uuid)`, `name`, `status ∈ {active, suspended}`, timestamps. The `id` matches the
  desktop's `app_config.tenant_id` (the Shop ID shown in Settings › Cloud Link).
- `subscriptions` — `tenant_id`, `plan`, `status`, `current_period_end` (v1: status set manually by a
  platform admin; billing provider integration is reserved).
- `users` — cloud humans; `role`, `email`, `password`, timestamps.
- `tenant_user` — pivot (owner ↔ tenants).
- `devices` — `id`, `tenant_id`, `name`, `token` (via Sanctum `personal_access_tokens`), `last_seen_at`.

**Mirrored business tables** (per the sync spec §4 — tenant-scoped copies, upserted by `id`):
`customers, assets, asset_types, bookings, orders, order_items, inventory, inventory_adjustments,
payments`. Every row carries `tenant_id`; primary keys are the desktop's UUIDs (upsert by `id`).
Money stays integer centavos; timestamps integer epoch-ms (MySQL `BIGINT`).

## 4. API surface

**Sync (device-token auth) — implements the locked protocol:**
- `GET  /api/health` → `{ ok, server_time }`.
- `POST /api/sync/push` → upsert the batch (transaction, idempotent by `id`), return `{ ok, watermark, accepted }`.
- `POST /api/sync/pull` → **reserved** (not v1).

**Desktop ↔ backend alignment contract (the desktop client is already built — the backend MUST match):**
- **URL shape:** the desktop calls `{cloud_url}/health` and `{cloud_url}/sync/push` verbatim
  (trailing slashes stripped). Laravel serves these under `/api/...`, so the shop's **`cloud_url`
  includes the `/api` prefix** — e.g. `https://cloud.example.com/api`. Document this in the device
  registration flow / Settings hint.
- **Health:** `GET /health` with `Authorization: Bearer <device_token>`. `200` → desktop shows
  Connected and immediately runs a push; `401/403` → "Device token rejected"; other/unreachable →
  "Can't reach cloud" with backoff (30s → cap 5min).
- **Push request** (what the desktop actually sends): JSON `{ protocol_version: 1, tenant_id,
  device_name, since, sent_at, changes: { <table>: [rows…] } }` — tables and change-markers exactly
  per `cloud-sync-protocol.md` §4–5. Rows are full local rows (snake_case, centavos, epoch-ms),
  upserted by `id`, applied in one transaction (all-or-nothing).
- **Push response:** `200 { ok: true, watermark, accepted }` — the desktop persists `watermark` as
  its `last_synced_at` (falls back to its own clock if absent — backend SHOULD always return it,
  from the server clock). Non-200 → the desktop keeps its old watermark and retries the same window.
- **Tenant safety:** the backend derives the tenant from the **token**, never from the payload's
  `tenant_id` (sanity/logging only); mismatch → `403`.
- **Suspended tenant:** `403` on health + push → desktop shows the token-rejected/cloud-unavailable
  state and keeps running fully local.
- **Versioning:** unknown `protocol_version` → `409 { min_supported }`.
- Any future protocol change is made **in `cloud-sync-protocol.md` first**, then implemented on both
  sides — the doc stays the single source of truth.

**Auth (humans):**
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` (Sanctum).
- Device registration: `POST /api/devices` (owner/admin creates a device → returns a one-time token to
  paste into the desktop's Cloud Link settings). `DELETE /api/devices/:id` (revoke = kill that device).

**Dashboard data (human session, tenant-scoped):**
- `GET /api/dashboard/kpis?tenant=…` — revenue, job counts, low-stock, etc. (read queries over the
  mirrored tables).
- Platform admin: `GET /api/admin/tenants`, `PATCH /api/admin/tenants/:id` (suspend/activate = kill-switch).

## 5. Dashboards & the money toggle

- **Owner dashboard** — full KPIs for their shop(s): revenue over time, payments/tender, profit,
  jobs by status, throughput, inventory, low stock; per-branch if multi-branch.
- **Shop admin dashboard** — **operations only by default**:
  - **Always visible:** jobs by status, throughput/turnaround, and **inventory in full** (stock
    levels *and* unit cost/price/margin — inventory is classified as operations, needed for reordering).
  - **Money (gated):** revenue/sales totals, payments & tender, overall profit.
  - **Owner-controlled toggle** (per shop, on the owner's cloud settings page): "show money to
    admins" — **default OFF**. Stored as a tenant-level setting.
- **Platform admin** — list tenants, subscription status, devices/last-seen, suspend/activate.
- **Rendering (decided):** **Blade + Livewire, latest stable v4** (all-PHP, no JS build step; verified
  actively maintained + first-party Laravel starter kit, 2026-07). Charts via a small drop-in JS lib.

## 6. Subscription gating / kill-switch (ties to BACK-0-012)

- Middleware rejects **sync** + **dashboard** for a tenant whose `status != active` (→ `403`; desktop
  shows "cloud suspended", keeps running fully local — never blocks shop operation).
- A platform admin flips `tenants.status` to `suspended` = remote kill of cloud access (local app is
  unaffected; it's local-first).

## 7. Deployment (Hostinger shared)

- Point the (sub)domain docroot at Laravel's `public/`; upload via git/SSH or hPanel; `composer install
  --no-dev`, set `.env` (MySQL creds from hPanel), `php artisan migrate`, `key:generate`, cache config.
- Scheduled tasks (if any later, e.g. prune stale devices) via **hPanel cron** hitting `artisan schedule:run`.
- Free SSL via hPanel. Desktop `cloud_url` → the HTTPS (sub)domain.

## 8. Dev environment

- PHP 8.3 + Composer 2.6 available locally (verified). Scaffold + build here.
- **DB:** develop against **SQLite** locally (zero-setup); **MySQL** in prod (Laravel switches via
  `.env` `DB_CONNECTION`). Schema/migrations written dialect-portable.

## 9. Decisions (confirmed 2026-07-08, via discussion)

1. **Dashboards:** ✅ Blade + **Livewire, latest stable v4** (community verified active; first-party
   Laravel backing). Not a just-released new major — stable line only.
2. **Repo:** ✅ separate repo at **`D:\Projects\zorviz-cloud`** (sibling to `D:\Projects\Zorviz`).
3. **DB:** ✅ SQLite for local dev, MySQL in prod (Hostinger).
4. **Human auth:** ✅ Sanctum **session** for the web dashboard; a **token API for mobile is added
   later** (side-by-side, no rework). Devices always bearer tokens.
5. **Subscription:** ✅ **manual** tenant `status` (active/suspended) set by the platform admin =
   kill-switch; billing-provider automation later.
6. **Cloud logins:** ✅ shop **owner AND shop admin** (per-shop `tenant_user` roles); platform admin
   is a given. Owner sees money; **admin is operations-only by default** with an owner-controlled
   per-shop "show money to admins" toggle (default off). **Inventory = operations** (fully visible
   to admins, incl. cost/margin).
7. **Multi-shop owners:** ✅ **Option A — shop = tenant.** Each desktop install stays its own tenant
   (self-generated `tenant_id`, as shipped); an owner with several shops is linked to each tenant via
   `tenant_user` and the dashboard shows all of them (shop switcher + combined view). **No `branch_id`**
   in the cloud model — locations are operationally independent shops; the desktop is unchanged. If a
   customer ever needs locations acting as ONE business (shared inventory/customers), revisit as a
   separate "organization" grouping — additive, cloud-side only.

## 10. Longevity & migration trigger

- **Use it while it serves the shops.** Shared hosting + Laravel is deliberately the cheap starting
  point. Our load is light (each shop's desktop POSTs a small diff periodically; owners open a
  dashboard occasionally), so it should comfortably carry the early network.
- **Migrate when we see real slowdown** — sync latency climbing, dashboard queries dragging, or
  hitting shared-hosting limits (PHP timeouts, connection/CPU caps). Then move to a VPS/managed host
  (Laravel Forge/Ploi on a VPS, or re-platform).
- **Why the switch stays low-risk:** the desktop only knows the **JSON sync contract** + its
  `cloud_url` — swapping the backend or host is transparent to every installed app (just repoint the
  URL; no reinstall). Data is tenant-scoped rows, straightforward to dump/restore into the new DB.
  So this interim choice doesn't lock us in.

## 11. Reserved / not v1

- `/sync/pull` + bidirectional/multi-device + conflict resolution.
- Media/file sync (ticket photos).
- App-layer encryption of the sync payload (BACK-4-008).
- Billing-provider integration; usage metering.
- Federating desktop local users to the cloud.
