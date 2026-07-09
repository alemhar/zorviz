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
  const tiles = await page.locator("main").innerText();
  console.log("tiles:", tiles.includes("Customers"), tiles.includes("Suppliers"));

  // ---- Customers directory ----
  await page.goto("http://localhost:3030/#/customers");
  await page.getByPlaceholder("Search by name or phone…").waitFor({ timeout: 10000 });
  await page.waitForTimeout(800);
  const dir = await page.locator("main").innerText();
  console.log("directory shows Pedro w/ balance:", dir.includes("Pedro Ramos") && dir.includes("owes"));
  await page.screenshot({ path: `${ART}/customers-dir.png` });

  // search narrows
  await page.getByPlaceholder("Search by name or phone…").fill("juan");
  await page.waitForTimeout(700);
  const filtered = await page.locator("main").innerText();
  console.log("search narrows:", filtered.includes("Juan") && !filtered.includes("Pedro"));

  // ---- Customer profile ----
  await page.getByText("Juan Dela Cruz").click();
  await page.getByText("Open balance").waitFor({ timeout: 10000 });
  const prof = await page.locator("main").innerText();
  console.log("profile: balance 1,251.20:", prof.includes("1,251.20"), "| lifetime:", prof.includes("Lifetime paid"), "| collect:", prof.includes("Collect"));
  await page.screenshot({ path: `${ART}/customer-profile.png`, fullPage: true });

  // edit notes
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel(/Notes/).fill("prefers GCash");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("prefers GCash").waitFor({ timeout: 5000 });
  console.log("notes saved and shown: true");

  // collect navigates to the ticket
  await page.getByRole("button", { name: /Collect/ }).first().click();
  await page.waitForURL(/#\/repair\/ticket\//, { timeout: 5000 });
  console.log("collect goes to ticket: true");

  // ---- Suppliers ----
  await page.goto("http://localhost:3030/#/suppliers");
  await page.getByText("AutoParts PH").waitFor({ timeout: 10000 });
  await page.screenshot({ path: `${ART}/suppliers-dir.png` });

  // profile: history shows the two settled receives
  await page.getByText("AutoParts PH").click();
  await page.getByText("Receive history").waitFor({ timeout: 10000 });
  const sup = await page.locator("main").innerText();
  console.log("supplier profile: owed 0:", sup.includes("Outstanding"), "| history rows:", (sup.match(/COMP/g) ?? []).length);
  await page.screenshot({ path: `${ART}/supplier-profile.png`, fullPage: true });

  // edit contact person
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Contact person").fill("Mang Ben");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Mang Ben").waitFor({ timeout: 5000 });
  console.log("supplier edit saved: true");

  // ---- New receive w/ NEW supplier name → implicit record + payable → settle from profile ----
  await page.goto("http://localhost:3030/#/inventory");
  await page.getByPlaceholder(/search/i).waitFor({ timeout: 10000 });
  await page.getByLabel("Adjust stock").first().click();
  await page.getByText("What did you pay?").waitFor();
  await page.getByLabel(/Supplier/).fill("Davao Gaskets Co");
  await page.getByLabel(/Quantity/).fill("1");
  await page.getByRole("button", { name: "On account" }).click();
  await page.getByLabel("Amount owed to the supplier").fill("150");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await confirmDialog(page);
  await page.waitForTimeout(800);

  await page.goto("http://localhost:3030/#/suppliers");
  await page.getByText("Davao Gaskets Co").waitFor({ timeout: 10000 });
  console.log("typed name created supplier record: true");
  await page.getByText("Davao Gaskets Co").click();
  await page.getByText("Open payables").waitFor({ timeout: 10000 });
  await page.screenshot({ path: `${ART}/supplier-open-payable.png`, fullPage: true });

  // settle from the profile; must RETURN to the profile
  await page.getByRole("button", { name: "Settle" }).first().click();
  await page.waitForURL(/#\/expenses$/, { timeout: 5000 });
  await page.getByRole("button", { name: /^Save|^Record|Add Expense/ }).click();
  await confirmDialog(page);
  await page.waitForURL(/#\/suppliers\//, { timeout: 5000 });
  console.log("settle returned to supplier profile: true");
  await page.waitForTimeout(1000);
  const after = await page.locator("main").innerText();
  console.log("payable cleared on profile:", !after.includes("Open payables"), "| owed 0.00:", after.includes("0.00"));
} finally {
  await browser.close();
}
console.log("DONE");
