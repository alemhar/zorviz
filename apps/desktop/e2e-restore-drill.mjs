import { chromium } from "playwright";
import fs from "node:fs";

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  await page.goto("http://localhost:3030/");
  // Fresh DB → setup chooser
  await page.getByText("How do you want to start?").waitFor({ timeout: 15000 });
  await page.screenshot({ path: "e2e-artifacts/restore-1-chooser.png" });
  await page.getByText("I already use Wurkz — restore from the cloud").click();

  await page.getByLabel("Cloud address").fill("http://127.0.0.1:8200/api");
  await page.getByLabel("Device token").fill("drill-token-123");
  await page.getByRole("button", { name: "Connect" }).click();
  await page.getByText("NP Car Aircon Repair").waitFor({ timeout: 15000 });
  console.log("tenant-info confirmed: NP Car Aircon Repair");
  await page.screenshot({ path: "e2e-artifacts/restore-2-confirm.png" });

  await page.getByRole("button", { name: "Restore this shop" }).click();
  await page.getByText("Who are you?").waitFor({ timeout: 30000 });
  const admins = await page.locator("button:has-text('· admin'), button:has-text('· owner')").count();
  console.log("claimable admin accounts:", admins);
  await page.getByText("Owner (Noel P.)").click();
  await page.locator("#pin-0").click().catch(async () => { await page.locator("input").last().click(); });
  await page.keyboard.type("123456");
  await page.screenshot({ path: "e2e-artifacts/restore-3-claim.png" });
  await page.getByRole("button", { name: "Set PIN & finish" }).click();
  await page.getByText("records restored").waitFor({ timeout: 15000 });
  const doneText = await page.locator("main, body").first().innerText();
  console.log("done screen:", doneText.match(/\d+ records restored/)?.[0]);
  await page.screenshot({ path: "e2e-artifacts/restore-4-done.png" });
  await page.getByRole("button", { name: "Go to sign in" }).click();

  // Sign in with the restored username + NEW pin
  await page.getByLabel("Username").waitFor({ timeout: 15000 });
  await page.getByLabel("Username").fill("admin");
  await page.locator("input").nth(1).click();
  await page.keyboard.type("123456");
  await page.waitForURL(/#\/$/, { timeout: 15000 });
  await page.getByText("Quick Access").waitFor();
  console.log("signed in to the RESTORED shop");

  // Verify data: counts via APIs + spot checks
  const verify = await page.evaluate(async () => {
    const auth = JSON.parse(localStorage.getItem("auth-storage") ?? "{}");
    const h = { Authorization: `Bearer ${auth?.state?.token}` };
    const changes = await (await fetch("/api/sync/changes?since=0", { headers: h })).json();
    const counts = Object.fromEntries(Object.entries(changes.tables).map(([k, v]) => [k, v.length]));
    const cfg = await (await fetch("/api/config", { headers: h })).json();
    const customers = await (await fetch("/api/customers/all?q=", { headers: h })).json();
    return { counts, tenant: cfg.tenant_id ?? changes.tenant_id, sync_enabled: cfg.sync_enabled, cloud_url: cfg.cloud_url,
             juan: customers.find((c) => c.name === "Juan Dela Cruz")?.balance ?? null };
  });
  const orig = JSON.parse(fs.readFileSync("snapshot-counts.json", "utf8"));
  let mismatch = [];
  for (const [t, n] of Object.entries(orig)) {
    const got = verify.counts[t] ?? 0;
    if (got !== n) mismatch.push(`${t}: ${got}/${n}`);
  }
  console.log("tenant preserved:", verify.tenant === "a20b7cf1-9cf1-4f80-b734-50785bd09a9c");
  console.log("sync re-enabled:", verify.sync_enabled === 1, "| cloud_url:", verify.cloud_url);
  console.log("Juan balance intact (125120):", verify.juan);
  console.log(mismatch.length ? "COUNT MISMATCHES: " + mismatch.join(", ") : "ALL TABLE COUNTS MATCH THE SNAPSHOT");
} finally {
  await browser.close();
}
console.log("DONE");
