# Drizzle ORM sqlite-proxy Column Mapping Issue (RESOLVED)

> **Status:** RESOLVED by migrating to Kysely (2026-01-24)

## Original Problem
When using `drizzle-orm/sqlite-proxy` with a Tauri backend (Rust/SQLx), Drizzle's result processing returns `undefined` for all properties despite receiving correct data from the database.

This was caused by Drizzle's sqlite-proxy not properly mapping snake_case DB columns to camelCase JS properties.

## Resolution
We migrated from Drizzle ORM to **Kysely** query builder which:
- Uses snake_case column names directly (matching the DB)
- Provides full type safety via TypeScript interfaces
- Works seamlessly with our custom Tauri SQLite dialect

## Current Stack
- **Query Builder:** Kysely
- **Types:** `packages/db/src/types.ts`
- **Tauri Dialect:** `apps/desktop/src/lib/tauri-dialect.ts`
- **Migrations:** Still using SQL files in `packages/db/migrations/sqlite`

## Key Files
- `packages/db/src/types.ts` - Database table interfaces
- `apps/desktop/src/lib/tauri-dialect.ts` - Custom Kysely dialect for Tauri
- `apps/desktop/src/lib/db.ts` - Kysely database instance
