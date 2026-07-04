# Phase 0 Completed — v1 Ship Blockers & Foundation

> Items here have been **fully implemented and verified**.
> When an item from [`phase-0-ship-blockers.md`](./phase-0-ship-blockers.md) is finished, move it here
> and fill in the implementation details.

---

## ✅ BACK-0-C001 · Fix the Production Build

**Completed:** 2026-07-04
**Original Backlog ID:** BACK-0-001
**Traces to:** D11

**What was implemented:**
- **Root cause 1 — duplicate React types.** `packages/ui`, `packages/features/repair`, and the
  `packages/features/inventory` stub each declared React 18 (`react`, `@types/react`) while the app
  runs React 19, producing nested v18 copies in their `node_modules`. The version collision caused all
  the "cannot be used as a JSX component" / `ReactNode`/`bigint` / `ForwardRefExoticComponent`
  type errors. Bumped all three packages' `react`/`react-dom`/`@types/react`/`@types/react-dom` (and
  `@zorviz/ui`'s `peerDependencies`) to `^19.0.0`, then reinstalled so npm deduped to the single root copy.
- **Root cause 2 — dead Drizzle code.** `packages/features/repair/src/types.ts` still imported
  `InferSelectModel` from `drizzle-orm` and referenced `schema.assets` / `schema.bookings` /
  `schema.orders`, which no longer exist after the Kysely migration (see
  `.agent/known-issues/drizzle-sqlite-proxy-mapping.md`). Rewrote it to import the Kysely types
  (`Asset`, `Booking`, `Order`) from `@zorviz/db`. `AssetWithHistory` now correctly types `specs` as a
  parsed object (`Omit<DbAsset, 'specs'> & { specs: Record<string, any> }`) to match the repository.
- **Malformed `CompiledQuery` casts.** `apps/desktop/src/lib/tauri-dialect.ts` built transaction
  queries as `{ sql, parameters } as CompiledQuery` (missing `query`/`queryId`). Replaced with Kysely's
  `CompiledQuery.raw('BEGIN'|'COMMIT'|'ROLLBACK')`.
- **Unused imports/params** (`noUnusedLocals`/`noUnusedParameters`) cleared in: `AssetDiscovery.tsx`
  (`CardTitle`), `tauri-dialect.ts` (`Database`), `main.tsx` (`colno`, `error`), `db/src/types.ts`
  (`Generated`), `repair/dal/asset.repo.ts` (`sql`), `repair/src/index.ts` (`private db` → `db`),
  `ui/theme-provider.tsx` (`useNextTheme`), `ui/theme-switcher.tsx` (`React`).

**Verification:**
- `tsc --noEmit` → exit 0 (was ~25 errors)
- `npm run build` (tsc + vite) → exit 0, emits `dist/`
- `npm run tauri build` → exit 0, produced installers:
  - `Zorviz_0.1.0_x64_en-US.msi` (4.6 MB)
  - `Zorviz_0.1.0_x64-setup.exe` (3.2 MB)

**Notes / follow-ups (not blockers):**
- Two nested React 18 *runtime* copies may still linger in `packages/ui` / `inventory` node_modules
  from transitive/older peer deps (e.g. `next-themes@0.2.1`). Types are correctly unified on v19 and
  the build is clean; if an "invalid hook call" appears at runtime, dedupe the runtime copies (bump
  `next-themes`, or set vite `resolve.dedupe: ['react','react-dom']`).
- `noUnusedLocals` was left ON (errors fixed rather than the flag relaxed).

**Key files:**
- `packages/ui/package.json`, `packages/features/repair/package.json`, `packages/features/inventory/package.json`
- `packages/features/repair/src/types.ts`
- `apps/desktop/src/lib/tauri-dialect.ts`
- `apps/desktop/src/main.tsx`, `apps/desktop/src/features/repair/components/AssetDiscovery.tsx`
- `packages/db/src/types.ts`, `packages/features/repair/src/dal/asset.repo.ts`, `packages/features/repair/src/index.ts`
- `packages/ui/src/components/theme-provider.tsx`, `packages/ui/src/components/theme-switcher.tsx`

---
