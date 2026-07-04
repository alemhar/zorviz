# Phase 1 Completed — Core Kernel

> Items here have been **fully implemented and verified**.  
> When an item from [`phase-1-backlog.md`](./phase-1-backlog.md) is finished, move it here and fill in the implementation details.

---

## ✅ BACK-1-C001 · Monorepo Setup (Turbo)

**Completed:** (initial setup)  
**PR / Commit:** *(initial commit)*

**What was implemented:**
- Turborepo configured at the root with `turbo.json`
- Root `package.json` defines workspaces: `apps/*`, `packages/*`
- `tsconfig.base.json` shared across all packages
- Packages: `@zorviz/core`, `@zorviz/db`, `@zorviz/ui`, `@zorviz/feature-repair`, `@zorviz/sync-engine`

**Key files:**
- `turbo.json`
- `package.json` (root)
- `tsconfig.base.json`

---

## ✅ BACK-1-C002 · Tauri Base App

**Completed:** (initial setup)  
**PR / Commit:** *(initial commit)*

**What was implemented:**
- Tauri v2 app scaffolded inside `apps/desktop/`
- Vite + React frontend wired to Tauri shell
- `src-tauri/` contains Rust backend with Tauri configuration
- `vite.config.ts` configured for Tauri dev mode
- PostCSS + Tailwind integrated

**Key files:**
- `apps/desktop/src-tauri/`
- `apps/desktop/vite.config.ts`
- `apps/desktop/package.json`

---

## ✅ BACK-1-C003 · Local SQLite Setup

**Completed:** (initial setup)  
**PR / Commit:** *(initial commit)*

**What was implemented:**
- `TauriSqliteDialect` custom Kysely dialect created in `apps/desktop/src/lib/tauri-dialect.ts`
- Bridges Kysely's query builder to Tauri's `@tauri-apps/plugin-sql` API
- `db` singleton exported from `apps/desktop/src/lib/db.ts`
- Database file stored at `apps/desktop/data/zorviz.db` (outside `src-tauri/` to avoid watch loop)
- Two SQLite migrations applied via `packages/db/migrations/sqlite/`
  - `0000_charming_gunslinger.sql` — initial schema
  - `0001_clumsy_pet_avengers.sql` — incremental update

**Key files:**
- `apps/desktop/src/lib/tauri-dialect.ts`
- `apps/desktop/src/lib/db.ts`
- `packages/db/migrations/sqlite/0000_charming_gunslinger.sql`
- `packages/db/migrations/sqlite/0001_clumsy_pet_avengers.sql`
- `packages/db/src/types.ts` — Kysely table interfaces & Database type

---

## ✅ BACK-1-C004 · Authentication (Local)

**Completed:** (initial setup)  
**PR / Commit:** *(initial commit)*

**What was implemented:**
- Zustand store `useAuthStore` in `apps/desktop/src/stores/auth.ts`
  - State: `user`, `isAuthenticated`
  - Actions: `login(email, password)`, `logout()`
  - Login verifies SHA-256 password hash against `users` table via Kysely
- Login page at `/login` (`apps/desktop/src/pages/login.tsx`)
  - Email + password form with validation
  - Error state on invalid credentials
- Route guards in `App.tsx` using `useAuthStore`
  - Unauthenticated users redirected to `/login`
  - Authenticated users redirected away from `/login`
- Seed script creates two default users:
  - `admin@zorviz.com` / `admin123` → role: `admin`
  - `mechanic@zorviz.com` / `admin123` → role: `mechanic`

**Key files:**
- `apps/desktop/src/stores/auth.ts`
- `apps/desktop/src/pages/login.tsx`
- `apps/desktop/src/App.tsx`
- `packages/db/src/seed.ts`

---

## ✅ BACK-1-C005 · App Config Store

**Completed:** (initial setup)  
**PR / Commit:** *(initial setup)*

**What was implemented:**
- Zustand store `useAppConfigStore` in `apps/desktop/src/stores/app-config.ts`
  - `fetchConfig()` reads the single row from `app_config` table
  - Exposes `config` (currency symbol, locale, branch info)
- Dashboard consumes `config.currency_symbol` for revenue display
- Seed script inserts default config: `tenant_id: 'dev-tenant-id'`, `currency_symbol: '₱'`, `locale: 'en-PH'`

**Key files:**
- `apps/desktop/src/stores/app-config.ts`
- `packages/db/src/seed.ts`

---

## ✅ BACK-1-C006 · UI Design System (`@zorviz/ui`)

**Completed:** (initial setup)  
**PR / Commit:** *(initial setup)*

**What was implemented:**
- `packages/ui` package built on shadcn/ui component primitives
- `components.json` configures shadcn registry
- Shared `styles.css` with CSS variables for light/dark theming
- Exported components: `Button`, `Input`, `Card`, `CardHeader`, `CardContent`, `CardTitle`, `ThemeSwitcher`
- `ThemeProvider` wraps the app and reads `system` preference by default
- `ThemeSwitcher` allows toggling Light / Dark / System

**Key files:**
- `packages/ui/src/index.ts`
- `packages/ui/src/styles.css`
- `packages/ui/src/components/`
- `packages/ui/tailwind.config.ts`

---

## ✅ BACK-1-C007 · Dashboard Page

**Completed:** (initial setup)  
**PR / Commit:** *(initial setup)*

**What was implemented:**
- Dashboard page at route `/` (`apps/desktop/src/pages/dashboard.tsx`)
- Header with Zorviz branding, ServerStatus indicator, user email/role, and Logout button
- Stats cards: Active Jobs (hardcoded), Pending Estimates (hardcoded), Low Stock (hardcoded), This Month Revenue (from config currency)
- Module navigation cards: Repair Shop (active), Inventory (Coming Soon), Settings (Coming Soon)
- `ThemeSwitcher` UI section
- `ServerStatus` component in `apps/desktop/src/components/server-status.tsx`

**Key files:**
- `apps/desktop/src/pages/dashboard.tsx`
- `apps/desktop/src/components/server-status.tsx`

---

## ✅ BACK-1-C008 · Seed Script

**Completed:** (initial setup)  
**PR / Commit:** *(initial setup)*

**What was implemented:**
- Node.js seed script at `packages/db/src/seed.ts`
- Uses `better-sqlite3` to write directly to the SQLite file
- Idempotent — skips records that already exist
- Seeds: `app_config` (1 row), `users` (admin + mechanic)
- DB path resolves to `apps/desktop/data/zorviz.db` relative to `packages/db`
- Password hashing: SHA-256 of `admin123` stored as hex string

**Key files:**
- `packages/db/src/seed.ts`

---
