import { chromium } from "playwright";
import fs from "node:fs";

const ART = "e2e-artifacts";
fs.mkdirSync(ART, { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  await page.goto("http://localhost:3030/#/login");
  await page.getByLabel("Username").fill("admin");
  await page.locator("input").nth(1).click();
  await page.keyboard.type("123456");
  await page.waitForURL(/#\/$/, { timeout: 10000 });
  await page.getByText("Cash Drawer").waitFor({ timeout: 10000 });

  await page.getByLabel("What do these buttons do?").click();
  await page.getByText("start tracking the till", { exact: false }).waitFor();
  const card = page.locator("div").filter({ has: page.getByText("Cash Drawer") }).last();
  await card.screenshot({ path: `${ART}/drawer-help.png` });
  console.log("help panel visible; screenshot saved");
} finally {
  await browser.close();
}
