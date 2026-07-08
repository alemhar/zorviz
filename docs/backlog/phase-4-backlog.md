# Phase 4 Backlog — Cloud Link

> **Status:** ~10% Complete (types + sync queue scaffolded, not integrated). **Backend parked.**  
> **Scope:** Postgres Mirror, Sync Engine, Next.js Dashboard, Customer Portal  
> **Completed items live in:** [`phase-4-completed.md`](./phase-4-completed.md)

> **Client-side prep shipped in the desktop app (2026-07-08)** so enabling cloud later needs no
> reinstall — only config:
> - **Unique per-install tenant identity** — setup now generates a UUID `tenant_id` (was the shared
>   `'dev-tenant'`); existing installs rotate to a UUID once at startup, cascading across the
>   tenant-scoped tables (`app_config`, `customers`, `assets`, `asset_types`).
> - **Cloud-link config** (migration 0019, `app_config`): `cloud_url`, `device_token`, `sync_enabled`
>   — **opt-in, default off**; the app runs fully offline whether or not they're set.
> - **Cloud Link settings card** (admin-only): enable toggle + backend URL + device token, and the
>   read-only, copyable **Shop ID (tenant)** to register in the backend.
> - **Cloud-link lifecycle + status** (`stores/cloud-sync.ts`, `components/cloud-sync-manager.tsx`,
>   `components/cloud-status.tsx`): when enabled + URL + token are set, the desktop polls the backend's
>   `/health` (device-token bearer) and shows a status pill (Off / Connecting / Connected / Can't reach).
>   **Fail-safe by design** — every failure (no backend, unreachable, timeout, 401) is caught + backed
>   off; it never throws/blocks, so a *mistaken enable with no backend* just reads "can't reach cloud"
>   and the app keeps running fully local.
> - **Sync protocol locked** — [`docs/cloud-sync-protocol.md`](../cloud-sync-protocol.md) (v1: push-only,
>   `updated_at` watermark, TLS, tenant-scoped). Both the desktop client and the future backend build to it.
> - **Change-tracking schema shipped** (migration 0020): `inventory` + `order_items` gained
>   `created_at`/`updated_at` (touched on every write in Rust), and `app_config` gained the
>   `last_synced_at` watermark — so an incremental push can answer "what changed since X."
> - **Push implemented (client side)** — local endpoints `GET /api/sync/changes` (assembles the
>   tenant-scoped batch of rows changed since the watermark) + `POST /api/sync/watermark` (advance);
>   `lib/cloud-sync.ts` `runSync()` collects → `POST {cloud_url}/sync/push` → advances the watermark;
>   runs on each healthy connect + a "Sync now" button in Settings. Fail-safe (can't succeed until the
>   backend answers — degrades to "can't reach cloud", zero local impact).
> - **Still parked:** the cloud **backend** itself (implements `/health` + `/sync/push` to the locked
>   spec), plus pull/bidirectional, media sync, and app-layer encryption. Enabling a shop then = config.

---

## BACK-4-001 · `apps/web` Next.js App Scaffold

**Priority:** 🔴 High (prerequisite for all Cloud Link features)  
**Area:** `apps/web/`  
**Description:**  
No Cloud Node application exists yet. The Next.js management dashboard and customer portal must be initialized.

**Acceptance Criteria:**
- [ ] `apps/web/` created via `npx create-next-app@latest`
- [ ] TypeScript, Tailwind, App Router configured
- [ ] Added to Turborepo workspace in root `package.json`
- [ ] Shared packages (`@zorviz/ui`, `@zorviz/db`) listed as dependencies
- [ ] Basic layout with navigation scaffold (Dashboard, Sync Status, Customers)
- [ ] Environment variable setup: `DATABASE_URL` for Postgres

---

## BACK-4-002 · Postgres Schema (Mirror of SQLite)

**Priority:** 🔴 High  
**Area:** `packages/db/` — new Postgres migration set  
**Description:**  
The Cloud Node needs a Postgres schema that mirrors the local SQLite schema. Drizzle ORM should manage both dialects.

**Acceptance Criteria:**
- [ ] `packages/db/migrations/postgres/` directory created
- [ ] Drizzle schema files written for all tables matching SQLite definitions
- [ ] `packages/db/src/schema.ts` — Drizzle table definitions (for Postgres/Drizzle-Kit)
- [ ] `drizzle.config.ts` pointing at Postgres URL for `drizzle-kit push`
- [ ] All column types compatible (SQLite INTEGER timestamps → Postgres BIGINT)
- [ ] Multi-tenant column `tenant_id` indexed on all module tables

---

## BACK-4-003 · Sync Engine — Network Transport Layer

**Priority:** 🔴 High  
**Area:** `packages/sync-engine/src/`  
**Description:**  
`SyncQueue`, `SyncChange`, and `resolveConflict()` are defined but never called. A transport layer must connect the local queue to the Cloud Node API.

**Acceptance Criteria:**
- [ ] `SyncTransport` interface defined:
  ```ts
  interface SyncTransport {
    push(changes: SyncChange[]): Promise<void>;
    pull(since: number): Promise<SyncChange[]>;
  }
  ```
- [ ] `HttpSyncTransport` implementation using `fetch` to a REST or tRPC endpoint
- [ ] `SyncEngine` class created that orchestrates: dequeue → push → pull → apply → resolve conflicts
- [ ] Conflict resolution uses existing `resolveConflict()` (Last Write Wins)
- [ ] `SyncEngine` integrated into the Tauri app — triggered manually or on a timer
- [ ] Sync status (last synced at, pending count) exposed via a Zustand store

---

## BACK-4-004 · Cloud API Endpoints (Sync)

**Priority:** 🔴 High  
**Area:** `apps/web/` — API routes  
**Description:**  
The Cloud Node must expose endpoints that the local `SyncEngine` can push changes to and pull updates from.

**Acceptance Criteria:**
- [ ] `POST /api/sync/push` — accepts `SyncChange[]`, applies to Postgres, returns conflicts
- [ ] `GET /api/sync/pull?since={timestamp}&deviceId={id}` — returns changes since last sync
- [ ] Endpoints authenticated via API key or JWT (device token)
- [ ] Idempotent: re-pushing the same change does not create duplicates
- [ ] Rate limiting applied

---

## BACK-4-005 · Device Registration & Auth

**Priority:** 🔴 High  
**Area:** `apps/web/`, `apps/desktop/`  
**Description:**  
Each Commander Node needs to be registered with the Cloud to receive a device token for authenticated sync.

**Acceptance Criteria:**
- [ ] `devices` table in Postgres: `id`, `tenant_id`, `name`, `token_hash`, `last_seen_at`
- [ ] Owner registers a device from the Cloud dashboard → generates a token
- [ ] Token stored in `app_config` on the local device (or Tauri secure store)
- [ ] All sync API calls include `Authorization: Bearer {device_token}`
- [ ] Token revocation supported from the Cloud dashboard

---

## BACK-4-006 · Owner Remote Dashboard (Cloud)

**Priority:** 🟡 Medium  
**Area:** `apps/web/`  
**Description:**  
The owner can log in to the web dashboard to view shop performance without being on-site.

**Acceptance Criteria:**
- [ ] Auth: NextAuth or Supabase Auth for owner login
- [ ] Dashboard page: Active Jobs count, Revenue this month, Low Stock alerts
- [ ] Jobs list: filterable by status, date range, assigned mechanic
- [ ] Read-only — owner cannot modify data from the cloud (for now)
- [ ] Responsive layout (desktop + mobile)

---

## BACK-4-007 · Customer Booking Portal (Cloud)

**Priority:** 🟢 Low  
**Area:** `apps/web/`  
**Description:**  
Customers can book a service appointment via a public web page without an account.

**Acceptance Criteria:**
- [ ] Public route `/book` — no login required
- [ ] Customer fills: Name, Contact Number, Asset description, Preferred date/time
- [ ] Booking stored in Postgres `bookings` table with status `pending`
- [ ] Next sync cycle pushes it down to the Commander Node
- [ ] SMS confirmation sent to customer (via Twilio or similar)

---

## BACK-4-008 · Encrypted Diff Sync

**Priority:** 🟢 Low  
**Area:** `packages/sync-engine/`  
**Description:**  
Sync payloads should be encrypted in transit and at rest on the cloud to protect customer and business data.

**Acceptance Criteria:**
- [ ] `SyncChange.data` encrypted client-side before `push()` using AES-256
- [ ] Encryption key derived from `tenant_id` + a secret stored only on-device (never sent to cloud)
- [ ] Cloud stores encrypted blobs — cannot read business data without device key
- [ ] Decryption happens on `pull()` before changes are applied locally
- [ ] Key management strategy documented (what happens if device is lost)

---
