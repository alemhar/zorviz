# Demo Credentials & Reset

The demo dataset (BACK-1-007) is loaded by the seeder scripts.

## Commands (from the repo root)

- **`npm run demo:reset`** — stop the app, wipe the dev data, relaunch the dev app, and seed a
  fresh demo. Use this before each demo.
- **`npm run demo:seed`** — seed only (assumes the app is already running and **not yet set up**).

> Dev workflow: the scripts target `apps/desktop/data`. For an installed build, data lives in
> `%LOCALAPPDATA%\Zorviz\data` — wipe that folder and launch the installed app instead, then
> `npm run demo:seed`.

## Shop

**NP Car Aircon Repair** — VAT-registered (12%), TIN 123-456-789-00000, proprietor "Noel P.",
Davao City. Document title "Job Order"; max manual discount 15%.

## Logins (username / PIN)

| Role     | Username | PIN  |
|----------|----------|------|
| Admin    | `admin`  | 1234 |
| Advisor  | `ana`    | 2222 |
| Mechanic | `boy`    | 3333 |

## What gets seeded

- 1 vehicle asset type; 5 customers (incl. a senior); 5 vehicles.
- Job orders spanning **every status**: triage, estimate (pending), approved, in-progress
  (assigned, partly done), done, paid, and a **paid Senior-discounted** order (20% + VAT-exempt).
- 2 bookings (one pending, one confirmed).

## Not seeded (do live)

- **Photos** — snap one from a phone during the demo (a nice moment). The seeder skips media so
  no sample images are bundled.
- **Logo** — upload one in Settings if you want it on the header/invoice.
