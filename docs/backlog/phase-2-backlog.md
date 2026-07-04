# Phase 2 Backlog — Repair Module

> **Status:** ~25% Complete (Asset Create done via single-path API)  
> **Scope:** Asset Management, Job Orders, Service History, Mechanic Views, Billing  
> **Completed items live in:** [`phase-2-completed.md`](./phase-2-completed.md)

---

## BACK-2-002 · Asset Detail / History View

**Priority:** 🔴 High  
**Area:** `apps/desktop/src/features/repair/components/`  
**Description:**  
Clicking an asset card in `AssetDiscovery` should open an Asset Detail view showing full specs and the complete service history (past job orders).

**Acceptance Criteria:**
- [ ] Tapping an asset card navigates to or opens an Asset Detail panel
- [ ] Displays: all specs, owner info (if any), asset type icon
- [ ] Service history section lists all past `orders` linked to this asset
  - Columns: Date, Status, Total, Technician
- [ ] `AssetRepository` gets a `getById(id)` method
- [ ] `AssetRepository` gets a `getServiceHistory(assetId)` method querying `orders` table
- [ ] `lastVisit` field in `AssetWithHistory` is populated from the most recent order

---

## BACK-2-003 · Asset Update & Soft-Delete

**Priority:** Medium  
**Area:** `packages/features/repair/src/dal/asset.repo.ts`  
**Description:**  
No update or delete operations exist in `AssetRepository`. Required for correcting data entry mistakes.

**Acceptance Criteria:**
- [ ] `AssetRepository.update(id, input)` method added
- [ ] `AssetRepository.softDelete(id)` sets `deleted_at` timestamp
- [ ] Soft-deleted assets are excluded from `search()` results by default
- [ ] Edit button on Asset Detail view opens a pre-filled form
- [ ] Delete requires confirmation dialog

---

## BACK-2-010 · Booking CRUD

**Priority:** 🟢 Low  
**Area:** `packages/features/repair/src/dal/`, `apps/desktop/src/features/repair/`  
**Description:**  
`BookingsTable` schema exists but has no repository or UI.

**Acceptance Criteria:**
- [ ] `BookingRepository` created with `create`, `list`, `updateStatus` methods
- [ ] "Today's Schedule" view on dashboard or repair page showing pending bookings
- [ ] "Convert to Job Ticket" action on a booking skips the Asset Recognition step
- [ ] Booking status transitions: `pending` → `confirmed` → `in_progress` → `completed`

---

## BACK-2-011 · Photo Capture & Local File Store

**Priority:** 🟡 Medium  
**Area:** `apps/desktop/src-tauri/`, `apps/desktop/src/features/repair/`  
**Description:**  
The intake form requires photo uploads. Photos should be saved to the local filesystem (not SQLite blobs) and referenced by path.

**Acceptance Criteria:**
- [ ] Tauri `fs` plugin used to save uploaded images to `{app_data_dir}/media/{order_id}/`
- [ ] File paths stored as JSON array string in `orders` table (or separate `order_photos` table)
- [ ] Photo thumbnail grid displayed in Intake form and Job Ticket detail
- [ ] Delete photo removes file from disk and updates record

---
