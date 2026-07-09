import { chromium } from "playwright";
import fs from "node:fs";

const ART = "e2e-artifacts";
fs.mkdirSync(ART, { recursive: true });

async function confirmDialog(page) {
  const btn = page.getByRole("button", { name: "Confirm", exact: true });
  await btn.waitFor({ timeout: 5000 });
  await btn.click();
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 420, height: 950 } });
  await page.goto("http://localhost:3030/#/login");
  await page.getByLabel("Username").fill("admin");
  await page.locator("input").nth(1).click();
  await page.keyboard.type("123456");
  await page.waitForURL(/#\/$/, { timeout: 10000 });
  await page.getByText("Quick Access").waitFor({ timeout: 10000 });

  // 1. Receive stock on account WITH a supplier name (tests capture)
  await page.goto("http://localhost:3030/#/inventory");
  await page.getByPlaceholder(/search/i).waitFor({ timeout: 10000 });
  await page.getByLabel("Adjust stock").first().click();
  await page.getByText("What did you pay?").waitFor();
  await page.getByLabel(/Supplier/).fill("AutoParts PH");
  await page.getByLabel(/Quantity/).fill("2");
  await page.getByRole("button", { name: "On account" }).click();
  await page.getByLabel("Amount owed to the supplier").fill("300");
  await page.screenshot({ path: `${ART}/receive-supplier.png` });
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await confirmDialog(page);
  await page.waitForTimeout(800);
  console.log("receive on account w/ supplier: done");

  // 2. Payables preview: grouped by supplier, Settle buttons
  await page.goto("http://localhost:3030/#/reports/payables");
  await page.getByText("Total owed to suppliers").waitFor({ timeout: 10000 });
  const main = await page.locator("main").innerText();
  console.log("groups:", main.includes("AutoParts PH"), "| ungrouped:", main.includes("no supplier recorded"));
  await page.screenshot({ path: `${ART}/payables-grouped.png`, fullPage: true });

  // 3. Settle the AutoParts PH payable → expense form pre-filled
  const group = page.locator("div.space-y-1").filter({ hasText: "AutoParts PH" }).first();
  await group.getByRole("button", { name: "Settle" }).first().click();
  await page.waitForURL(/#\/expenses$/, { timeout: 5000 });
  await page.getByText("Record this expense", { exact: false }).waitFor({ timeout: 5000 }).catch(() => {});
  // dialog open with amount prefilled?
  const amt = await page.getByLabel(/Amount/).first().inputValue();
  const sel = await page.locator("select").first().inputValue();
  console.log("settle handoff: amount =", amt, "| settle selected:", sel !== "");
  await page.screenshot({ path: `${ART}/settle-prefilled.png` });
  // record it
  await page.getByRole("button", { name: /^Save|^Record/ }).click().catch(async () => {
    await page.getByRole("button", { name: "Add Expense" }).click().catch(() => {});
  });
  await confirmDialog(page);
  await page.waitForTimeout(800);
  console.log("expense recorded");

  // 4. Payable gone from the list
  await page.goto("http://localhost:3030/#/reports/payables");
  await page.waitForTimeout(1200);
  const after = await page.locator("main").innerText();
  console.log("AutoParts payable cleared:", !after.includes("AutoParts PH"));

  // 5. Receivables preview + SOA + PDF
  await page.goto("http://localhost:3030/#/reports/receivables");
  await page.getByText("Total outstanding").waitFor({ timeout: 10000 });
  const recv = await page.locator("main").innerText();
  console.log("receivables text sample:", recv.split("\n").slice(0, 6).join(" | "));
  await page.screenshot({ path: `${ART}/receivables.png`, fullPage: true });
  const dl1 = page.waitForEvent("download", { timeout: 15000 });
  await page.getByRole("button", { name: "SOA" }).first().click();
  const d1 = await dl1;
  await d1.saveAs(`${ART}/receivable-soa.pdf`);
  console.log("soa from receivables:", d1.suggestedFilename());
  const dl2 = page.waitForEvent("download", { timeout: 15000 });
  await page.getByRole("button", { name: /PDF/ }).click();
  const d2 = await dl2;
  await d2.saveAs(`${ART}/receivables.pdf`);
  console.log("receivables pdf:", d2.suggestedFilename());
} finally {
  await browser.close();
}
console.log("DONE");
