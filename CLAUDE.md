# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Zorviz is a **strict local-first**, modular ERP platform for small repair shops (cars, gadgets, appliances), built as a Turborepo/npm-workspaces monorepo. The desktop app (Tauri 2 + React 19) must run fully offline forever; cloud sync is a future optional add-on. See `Plan.txt` and `Technical_Architecture.txt` for the master plan and architecture.

**Core design rule:** do NOT hardcode "mechanic" or "car" concepts into core code. Use abstract terms (`Asset`, `Order`, `Booking`) — the repair domain lives only in feature modules.

## Commands

```powershell
npm install                  # from repo root (npm workspaces)

# Desktop app (the main deliverable) — run from apps/desktop
npm run tauri dev            # full app: starts Vite + Rust backend (requires Rust toolchain, see docs/RUST_SETUP.md)
npm run tauri build          # produce standalone installer
npm run dev                  # Vite only (no Tauri backend — DB calls will fail)

# From repo root (Turborepo)
npm run build                # turbo build across workspaces
npm run lint                 # turbo lint (eslint per package)
npm run format               # prettier

# Database seeding — run from packages/db (app must have run once to create the DB)
npm run seed
```

There is no test runner configured anywhere in the repo.

## Architecture

### Monorepo layout

- `apps/desktop` — Tauri 2 app. React 19 + Vite + Tailwind frontend; Rust backend in `src-tauri`.
- `packages/core` — `@zorviz/core`: shared types, Zod validation, calculations. No React.
- `packages/db` — `@zorviz/db`: Kysely `Database` interface (`src/types.ts`) + SQL migrations (`migrations/sqlite/`) + seeder.
- `packages/ui` — `@zorviz/ui`: shared shadcn-style components (Radix + Tailwind + CVA).
- `packages/features/repair` — `@zorviz/feature-repair`: the Repair module — a `RepairModule` class exposing repositories (e.g. `AssetRepository`) built on a Kysely instance. New business modules follow this pattern.
- `packages/sync-engine` — `@zorviz/sync-engine`: scaffolded replication logic, not yet integrated.
- `lan-server-spike/` — throwaway spike, ignore.

Workspace packages ship raw TypeScript (`main` points at `src/index.ts`); Vite compiles them with the app — there is no per-package build step to run during dev.

### Database path: frontend → Rust → SQLite

This is the most important flow to understand:

1. Rust (`src-tauri/src/db.rs`) owns the SQLite connection (sqlx pool) and exposes a generic `execute_sql` Tauri command.
2. The frontend uses **Kysely** with a custom dialect (`apps/desktop/src/lib/tauri-dialect.ts`) that forwards compiled SQL through `invoke('execute_sql')`.
3. `apps/desktop/src/lib/db.ts` creates the shared `db` (Kysely) instance and instantiates feature modules with it.

Key facts:

- **Use Kysely, not Drizzle.** Drizzle was abandoned due to a sqlite-proxy column-mapping bug (see `.agent/known-issues/drizzle-sqlite-proxy-mapping.md`). `drizzle-orm` still appears in package.json but must not be used for queries.
- Column names are **snake_case end-to-end** (no camelCase mapping layer).
- Migrations are plain SQL files in `packages/db/migrations/sqlite/`, applied at app startup by `sqlx::migrate!` in `db.rs` (path is compile-time relative to `src-tauri`). Adding a table = new numbered `.sql` file there + matching interface in `packages/db/src/types.ts` (add it to the `Database` interface).
- The DB file lives at `apps/desktop/data/zorviz.db` ("portable mode" — deliberately outside `src-tauri` to avoid the dev file-watch loop).

### Rust backend (`apps/desktop/src-tauri/src`)

- `lib.rs` — app setup: initializes DB pool, starts the LAN HTTP server, registers Tauri commands (`greet`, `get_server_url`, `execute_sql`).
- `server.rs` — axum HTTP server on port 3030 bound to the LAN IP. This makes the desktop app the "Commander node" that mobile "Scout nodes" will connect to over LAN.

### Frontend (`apps/desktop/src`)

- `HashRouter` routing in `App.tsx`; pages in `src/pages/`, guarded by auth state.
- State: Zustand stores in `src/stores/`. Auth (`auth.ts`) is fully local — SHA-256 hash compared against the `users` table, persisted to localStorage. Roles: `admin | advisor | mechanic | customer`.
- Mechanic-facing views (job board, execution) must be **mobile-first** (small screens, touch targets) per Plan.txt.

## Backlog Workflow

Work is tracked in `docs/backlog/` with IDs like `BACK-2-004` (phase 2, item 4). When completing an item, follow `.agent/skills/complete-backlog-item/SKILL.md`: move the item from `phase-X-backlog.md` to `phase-X-completed.md` with honest implementation notes (only what was actually built), and update the README progress table.
