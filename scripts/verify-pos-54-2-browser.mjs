#!/usr/bin/env node
/**
 * Browser smoke for POS-54-2: manager login → /admin/cash-flow production panel.
 * Requires dev server at WEB_BASE and API at NEXT_PUBLIC_API_URL.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const MANAGER_EMAIL =
  process.env.TEST_MANAGER_EMAIL ?? "manager-test@cymonevo.com";
const MANAGER_PASSWORD =
  process.env.TEST_MANAGER_PASSWORD ?? "LunaTesting123!";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const insightResponses = [];
  page.on("response", async (response) => {
    const url = response.url();
    if (url.includes("/api/admin/insights/production/next-day")) {
      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      insightResponses.push({ status: response.status(), body });
    }
  });

  await page.goto(`${WEB_BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', MANAGER_EMAIL);
  await page.fill('input[type="password"]', MANAGER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 15000 });

  await page.goto(`${WEB_BASE}/admin/cash-flow`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="production-insight-panel"]', {
    timeout: 15000,
  });

  const panelText = await page
    .locator('[data-testid="production-insight-panel"]')
    .innerText();

  if (!/Generated/i.test(panelText)) {
    throw new Error("Production panel missing Generated timestamp");
  }

  if (/undefined|NaN/i.test(panelText)) {
    throw new Error("Production panel contains undefined or NaN");
  }

  const insightCall = insightResponses.find((r) => r.status === 200);
  if (!insightCall?.body?.success) {
    throw new Error("No successful production next-day insight network call");
  }

  const menus = insightCall.body?.data?.menus ?? [];
  if (menus.length > 0) {
    const tableText = await page.locator("table").last().innerText();
    if (!/\d/.test(tableText)) {
      throw new Error("Production table has no numeric values for seeded menus");
    }

    const limited = menus.some((m) => m.is_limited_by_ingredients);
    if (limited && !/Limited/.test(panelText)) {
      throw new Error("Ingredient-limited row missing Limited badge in UI");
    }
  }

  await browser.close();
  console.log("Browser smoke passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
