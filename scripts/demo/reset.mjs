// BACK-1-007 — Demo reset for Zorviz (dev workflow, Windows).
// One command to start a demo from scratch: stop the app, wipe its data, relaunch the
// dev app, then seed the demo dataset.
//
// Usage:  npm run demo:reset
//
// Notes:
//  - Targets the DEV data dir (apps/desktop/data). For an installed build the data lives
//    in %LOCALAPPDATA%\Zorviz\data — wipe that instead and launch the installed exe.
//  - Guardrail: only ever touches the known demo/dev data dir; never a configured backup dir.

import { execSync, spawn } from "node:child_process";
import { existsSync, rmSync, openSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { seedDemo } from "./seed.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DESKTOP = path.join(ROOT, "apps", "desktop");
const DATA = path.join(DESKTOP, "data");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function killPort(port) {
    try {
        const out = execSync(`netstat -ano | findstr :${port}`, { stdio: ["ignore", "pipe", "ignore"] }).toString();
        const pids = new Set();
        for (const line of out.split(/\r?\n/)) {
            const m = line.trim().match(/\s(\d+)$/);
            if (m && line.includes(`:${port}`)) pids.add(m[1]);
        }
        for (const pid of pids) {
            try { execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" }); } catch { /* gone */ }
        }
    } catch { /* nothing listening */ }
}

async function main() {
    console.log("Zorviz demo reset\n");

    // 1) Stop any running app (Rust server + Vite dev).
    console.log("• stopping app (if running)…");
    try { execSync("taskkill /F /IM zorviz-desktop.exe", { stdio: "ignore" }); } catch { /* not running */ }
    killPort(3030);
    killPort(1420);
    await sleep(1500);

    // 2) Wipe the dev data (DB + media + license/trial). Backups folder is left intact.
    console.log(`• wiping data: ${DATA}`);
    for (const f of ["zorviz.db", "zorviz.db-wal", "zorviz.db-shm", "license.json", "trial.json"]) {
        const p = path.join(DATA, f);
        try { if (existsSync(p)) rmSync(p, { force: true }); }
        catch (e) { console.error(`  ! could not delete ${f} — is the app still open? (${e.code})`); process.exit(1); }
    }
    try { rmSync(path.join(DATA, "media"), { recursive: true, force: true }); } catch { /* none */ }

    // 3) Relaunch the dev app (detached; migrations recreate a fresh DB).
    console.log("• launching dev app (npm run tauri dev)…");
    const logFd = openSync(path.join(ROOT, "demo-dev.log"), "a");
    const child = spawn("npm run tauri dev", { cwd: DESKTOP, detached: true, shell: true, stdio: ["ignore", logFd, logFd] });
    child.unref();

    // 4) Seed (seedDemo waits for the server and requires a fresh app).
    console.log("• waiting for server + seeding…\n");
    await seedDemo();
    console.log("\nDone. The app window should be open with fresh demo data. (dev output → demo-dev.log)");
}

main().catch((e) => { console.error("\n❌ Reset failed:", e.message); process.exit(1); });
