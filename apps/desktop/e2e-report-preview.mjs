import { chromium } from "playwright";
import fs from "node:fs";

const ART = "e2e-artifacts";
fs.mkdirSync(ART, { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  await page.goto("http://localhost:3030/#/login");
  await page.getByLabel("Username").fill("admin");
  await page.locator("input").nth(1).click();
  await page.keyboard.type("123456");
  await page.waitForURL(/#\/$/, { timeout: 10000 });
  await page.getByText("Quick Access").waitFor({ timeout: 10000 });

  await page.goto("http://localhost:3030/#/reports");
  await page.getByText("Profit & Loss Summary").waitFor();
  await page.screenshot({ path: `${ART}/reports-index.png` });

  // P&L preview: switch to All time, check numbers render
  await page.getByText("Profit & Loss Summary").click();
  await page.waitForURL(/#\/reports\/pnl$/);
  await page.getByRole("button", { name: "All time" }).click();
  await page.getByText("NET (revenue − expenses)").waitFor({ timeout: 10000 });
  await page.screenshot({ path: `${ART}/preview-pnl.png`, fullPage: true });
  const body = await page.locator("main").innerText();
  console.log("pnl has revenue:", body.includes("1,000.00"), "| has expenses:", body.includes("2,000.00"));

  // PDF still downloads from the preview page
  const dl = page.waitForEvent("download", { timeout: 15000 });
  await page.getByRole("button", { name: /PDF/ }).click();
  const d = await dl;
  console.log("pdf from preview:", d.suggestedFilename());

  // Payables: periodless — no preset row
  await page.goto("http://localhost:3030/#/reports/payables");
  await page.getByText("Total owed to suppliers").waitFor({ timeout: 10000 });
  const presets = await page.getByRole("button", { name: "This Month" }).count();
  console.log("payables preset row hidden:", presets === 0);
  await page.screenshot({ path: `${ART}/preview-payables.png`, fullPage: true });

  // Spot-check the other three load
  for (const k of ["vat", "senior", "mechanics"]) {
    await page.goto(`http://localhost:3030/#/reports/${k}`);
    await page.getByRole("button", { name: "All time" }).click();
    await page.waitForTimeout(600);
    const txt = await page.locator("main").innerText();
    console.log(`${k} loaded:`, !txt.includes("Loading"), "|", txt.split("\n").slice(-2)[0].slice(0, 60));
  }
} finally {
  await browser.close();
}
console.log("DONE");
