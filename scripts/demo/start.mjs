// Launch the dev app WITHOUT wiping or seeding — keeps whatever data is there.
// Companion to reset.mjs for when you want to continue from the current state.
//
// Usage:  npm run demo:start
//
// The app is spawned detached (dev output → demo-dev.log), so the terminal returns.

import { execSync, spawn } from "node:child_process";
import { openSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DESKTOP = path.join(ROOT, "apps", "desktop");
const BASE = process.env.ZORVIZ_BASE || "http://localhost:3030";

async function serverUp() {
    try {
        const r = await fetch(`${BASE}/api/info`);
        return r.ok;
    } catch {
        return false;
    }
}

async function main() {
    console.log("Zorviz demo start (no reset)\n");

    if (await serverUp()) {
        console.log(`• already running at ${BASE} — nothing to do.`);
        return;
    }

    // Clear any zombie holding the ports (window closed but process wedged).
    try { execSync("taskkill /F /IM zorviz-desktop.exe", { stdio: "ignore" }); } catch { /* not running */ }

    console.log("• launching dev app (npm run tauri dev)…");
    const logFd = openSync(path.join(ROOT, "demo-dev.log"), "a");
    const child = spawn("npm run tauri dev", { cwd: DESKTOP, detached: true, shell: true, stdio: ["ignore", logFd, logFd] });
    child.unref();

    process.stdout.write("• waiting for the server");
    for (let i = 0; i < 240; i++) {
        if (await serverUp()) {
            console.log(`\n\n✅ App is up at ${BASE} — existing data intact. (dev output → demo-dev.log)`);
            return;
        }
        process.stdout.write(".");
        await new Promise((r) => setTimeout(r, 1000));
    }
    console.error("\n❌ Server didn't come up — check demo-dev.log for a compile error.");
    process.exit(1);
}

main().catch((e) => { console.error("\n❌ Start failed:", e.message); process.exit(1); });
