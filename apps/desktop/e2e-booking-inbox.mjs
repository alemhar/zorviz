import { chromium } from "playwright";
import fs from "node:fs";

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto("http://localhost:3030/#/login");
  await page.getByLabel("Username").fill("admin");
  await page.locator("input").nth(1).click();
  await page.keyboard.type("123456");
  await page.waitForURL(/#\/$/);
  await page.waitForTimeout(500);

  const drain = async () =>
    page.evaluate(async () => {
      const auth = JSON.parse(localStorage.getItem("auth-storage") ?? "{}");
      const h = { Authorization: `Bearer ${auth?.state?.token}` };
      const inbox = await (await fetch("http://127.0.0.1:8200/api/sync/booking-inbox")).json();
      const requests = inbox.requests ?? [];
      if (!requests.length) return { requests: 0 };
      const mat = await (
        await fetch("/api/sync/materialize-bookings", {
          method: "POST",
          headers: { ...h, "Content-Type": "application/json" },
          body: JSON.stringify({ requests }),
        })
      ).json();
      await fetch("http://127.0.0.1:8200/api/sync/booking-ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: requests.map((r) => r.id) }),
      });
      return { requests: requests.length, ...mat };
    });

  console.log("first drain:", JSON.stringify(await drain()));
  const redeliver = await page.evaluate(async () => {
    const auth = JSON.parse(localStorage.getItem("auth-storage") ?? "{}");
    const h = { Authorization: `Bearer ${auth?.state?.token}`, "Content-Type": "application/json" };
    const requests = [
      { id: "req-e2e-001", customer_name: "Maria Santos", customer_phone: "0917-888-1234", customer_email: "maria@example.com", asset_description: "Toyota Vios 2019, ABC-5678", concern: "Aircon not cold", confirmed_time: Date.now() + 86400000 },
      { id: "req-e2e-002", customer_name: "Jose Rizal Jr", customer_phone: "0918-777-4321", customer_email: null, asset_description: "Mitsubishi L300", concern: "Compressor noise", confirmed_time: Date.now() + 2 * 86400000 },
    ];
    return await (await fetch("/api/sync/materialize-bookings", { method: "POST", headers: h, body: JSON.stringify({ requests }) })).json();
  });
  console.log("lost-ACK redelivery:", JSON.stringify(redeliver), "| dedupe ok:", redeliver.created === 0 && redeliver.skipped === 2);

  await page.goto("http://localhost:3030/#/bookings");
  await page.getByText("Maria Santos").waitFor({ timeout: 10000 });
  const badges = await page.getByText("online booking", { exact: true }).count();
  console.log("online-booking badges visible:", badges);
  await page.screenshot({ path: "e2e-artifacts/bookings-online-badge.png", fullPage: true });

  const log = fs.readFileSync("mock-cloud.log", "utf8");
  console.log("mock saw ack:", log.includes("req-e2e-001"));
  const after = await page.evaluate(async () => (await (await fetch("http://127.0.0.1:8200/api/sync/booking-inbox")).json()).requests.length);
  console.log("mock inbox now empty:", after === 0);
} finally {
  await browser.close();
}
console.log("DONE");
