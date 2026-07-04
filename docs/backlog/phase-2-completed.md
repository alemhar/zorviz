# Phase 2 Completed — Repair Module

> Items here have been **fully implemented and verified**.  
> When an item from [`phase-2-backlog.md`](./phase-2-backlog.md) is finished, move it here and fill in the implementation details.

---

## ✅ BACK-2-C001 · Asset Search (AssetDiscovery Component)

**Completed:** (initial setup)  
**PR / Commit:** *(initial setup)*

**What was implemented:**
- `AssetRepository.search(query: string)` in `packages/features/repair/src/dal/asset.repo.ts`
  - Queries `assets` table using `LIKE` on `id` and `specs` (JSON string) columns
  - For each result, joins `bookings` to check for pending/confirmed bookings
  - Returns `AssetWithHistory[]` array (max 10 results)
- `AssetDiscovery` component in `apps/desktop/src/features/repair/components/AssetDiscovery.tsx`
  - Debounced search with 300ms delay via `useEffect`
  - Displays results as shadcn `Card` components
  - Shows asset type icon (Car / Smartphone / Watch)
  - Shows "Booked" badge if pending booking exists
  - Shows "No assets found. Tap '+' to create." when query returns nothing
  - `+` button present but **not yet wired** (tracked in BACK-2-001)
- `RepairPage` at route `/repair` wraps `AssetDiscovery` with a back-navigation header
- `RepairModule` class in `packages/features/repair/src/index.ts` exposes `assets: AssetRepository`
- `db.ts` instantiates `repairModule` using the Kysely `db` singleton

**Key files:**
- `packages/features/repair/src/dal/asset.repo.ts`
- `packages/features/repair/src/index.ts`
- `packages/features/repair/src/types.ts`
- `apps/desktop/src/features/repair/components/AssetDiscovery.tsx`
- `apps/desktop/src/pages/repair.tsx`
- `apps/desktop/src/lib/db.ts`

---

## ✅ BACK-2-C002 · Asset Create (Repository Layer Only)

**Completed:** (initial setup)  
**PR / Commit:** *(initial setup)*

**What was implemented:**
- `AssetRepository.create(input: CreateAssetInput)` added to `asset.repo.ts`
  - Generates UUID via `crypto.randomUUID()`
  - Inserts into `assets` table with `tenant_id`, `owner_id`, `type`, `specs` (JSON serialized), timestamps
  - Returns the newly created `AssetWithHistory` object
- `CreateAssetInput` type defined in `packages/features/repair/src/types.ts`:
  ```ts
  type CreateAssetInput = {
    ownerId?: string;
    tenantId?: string;
    type: 'vehicle' | 'gadget' | 'appliance';
    specs: Record<string, any>;
  }
  ```
- **Note:** UI form to invoke this is not yet built (tracked in BACK-2-001)

**Key files:**
- `packages/features/repair/src/dal/asset.repo.ts` — `create()` method
- `packages/features/repair/src/types.ts` — `CreateAssetInput`, `JobTicketInput`

---
