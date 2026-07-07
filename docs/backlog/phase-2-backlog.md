# Phase 2 Backlog — Repair Module

> **Status:** One open item (BACK-2-012, date filter on Jobs). Everything else complete — core loop,
> asset detail/edit/soft-delete, lightweight bookings, photos + note threads, role-based Jobs views,
> Start Job + timing, cancel, discounts. Completed items live in [`phase-2-completed.md`](./phase-2-completed.md).
> **Scope:** Asset Management, Job Orders, Service History, Mechanic Views, Billing

---

## BACK-2-012 · Jobs Page — Date Filter (default: today)

**Priority:** 🟡 Medium
**Area:** `apps/desktop/src/pages/jobs.tsx` (+ optionally `list_orders` in `api_data.rs` for server-side filtering)
**Origin:** Owner request 2026-07-07.

**Description:**
The staff **Jobs** view (all jobs, all statuses) currently lists everything. Add a **date filter**:
a single-date picker **and** a from–to **date range**, and make the page **default to showing only
today's jobs**. Quick-select presets would make it fast in daily use (e.g. Today / This Week /
This Month / All / Custom range).

**Owner decisions already made:**
- Both a single date **and** a date range must be supported.
- **Default = today only.**

**Acceptance Criteria:**
- [ ] Staff Jobs view opens filtered to **today** by default (with a clear indicator + one-tap way
      to widen, e.g. an "All" chip)
- [ ] Single-date pick shows only jobs from that date
- [ ] Date-range pick (from–to, inclusive) shows jobs within the range
- [ ] Date filter composes with the existing **status filter chips** (e.g. "paid" + "this week")
- [ ] Mechanic **My Jobs** view is unaffected (it's the active work queue — approved/in_progress
      must never be hidden by a date)

**Open questions (decide at build time):**
- **Which date field?** `created_at` (intake date) is the natural default; consider whether
  done/paid jobs should instead match on `completed_at`/`updated_at` ("what did we finish today?").
- **Default-today vs. open work:** with a strict today-only default, yesterday's still-open jobs
  (triage/estimate/in-progress) disappear from the default view — decide whether open jobs should
  always show regardless of date, or keep the default strict (owner leaned strict "today").
- **Client vs. server filtering:** client-side over `scope=all` is simplest at shop scale;
  `?from=&to=` params on `GET /api/orders` scale better long-term.

---

## BACK-2-013 · Photo Notes — Mobile Keyboard Covers the Input

**Priority:** 🟡 Medium (mobile UX bug — the phone flow is a core selling point)
**Area:** `apps/desktop/src/features/repair/components/TicketPhotos.tsx` (photo dialog + Notes thread)
**Origin:** Owner found while live-testing on a phone, 2026-07-07.

**Problem:**
In the photo detail dialog, when the **"Add a note…"** field gets focus on a phone, the on-screen
keyboard slides up **over the input** — the user can't see what they're typing. The dialog is
vertically packed (photo image + note thread + input + delete row), so the input sits near the
bottom of the viewport, exactly where the keyboard appears.

**Goal:** find a good mobile UX so the input (and ideally the newest notes) stay visible above the
keyboard while typing. Explore, prototype on a real phone, and pick — candidates:

1. **Keyboard-aware viewport handling** — use the `visualViewport` API (resize/scroll events) to
   add bottom padding / translate the dialog so the focused input stays above the keyboard; plus
   `scrollIntoView({block: "center"})` on focus. Also evaluate the
   `<meta name="viewport" content="... interactive-widget=resizes-content">` option (Chrome
   Android) so the layout viewport shrinks instead of the keyboard overlaying.
2. **Compact-on-focus layout** — when the note input is focused on a small screen, shrink the
   photo (thumbnail-height) and cap the thread's height so the input naturally sits high enough.
3. **Bottom-sheet compose mode** — tapping "Add a note" opens a minimal compose bar/sheet (input +
   send only, photo hidden) — the classic chat-app pattern; most work, best-feeling result.

**Acceptance Criteria:**
- [ ] On a real phone (LAN browser), focusing the note field keeps the field **fully visible**
      above the on-screen keyboard while typing
- [ ] The most recent note (or the thread's tail) remains visible where feasible
- [ ] No regression on desktop (dialog unchanged there)
- [ ] Verify on both Android Chrome and iOS Safari if available (their keyboard/viewport
      behaviors differ — `visualViewport` support/quirks vary)

---
