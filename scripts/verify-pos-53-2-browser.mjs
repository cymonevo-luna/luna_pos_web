#!/usr/bin/env node
/**
 * Browser smoke for POS-53-2: manager login → production request form single-item estimation.
 * Requires dev server at WEB_BASE and API at NEXT_PUBLIC_API_URL.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const MANAGER_EMAIL =
  process.env.TEST_MANAGER_EMAIL ?? "manager-test@cymonevo.com";
const MANAGER_PASSWORD =
  process.env.TEST_MANAGER_PASSWORD ?? "LunaTesting123!";
const DEBOUNCE_MS = 400;

function parseEstimateBody(body) {
  if (!body || typeof body !== "object") return null;
  const data = body.data ?? body;
  if (!data || !Array.isArray(data.items)) return null;
  return data.items.map((item) => ({
    menu_id: item.menu_id,
    quantity: item.quantity,
  }));
}

async function waitForEstimateBadge(page) {
  await page.waitForSelector('[data-testid="production-estimation-overall-badge"]', {
    timeout: 10000,
  });
  const text = await page
    .locator('[data-testid="production-estimation-overall-badge"]')
    .innerText();
  if (!/^(Sufficient stock|Insufficient stock)$/.test(text.trim())) {
    throw new Error(`Unexpected estimation badge text: ${text}`);
  }
  return text.trim();
}

async function selectMenuAtRow(page, rowIndex, searchTerm) {
  const menuButton = page.locator('button[aria-haspopup="listbox"]').nth(rowIndex);
  await menuButton.click();
  await page.getByLabel("Search menus").fill(searchTerm);
  await page.waitForTimeout(DEBOUNCE_MS);
  await page.getByRole("option").first().click();
}

async function main() {
  const estimatePosts = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("/api/admin/production-requests/estimate")
    ) {
      estimatePosts.push({
        postData: request.postDataJSON(),
      });
    }
  });

  await page.goto(`${WEB_BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', MANAGER_EMAIL);
  await page.fill('input[type="password"]', MANAGER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 15000 });

  await page.goto(`${WEB_BASE}/admin/production-requests/new`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector('button:has-text("Add line item")', {
    timeout: 15000,
  });

  await page.getByRole("button", { name: "Add line item" }).click();
  await selectMenuAtRow(page, 0, "QA Nasi Goreng");

  const quantityInput = page.locator('input[type="number"]').first();
  await quantityInput.fill("5");
  await page.waitForTimeout(DEBOUNCE_MS);

  const badgeText = await waitForEstimateBadge(page);
  console.log(`Estimation badge after quantity 5: ${badgeText}`);

  const firstEstimate = estimatePosts.at(-1);
  if (!firstEstimate?.postData?.items) {
    throw new Error("No estimate POST captured after first row");
  }
  if (firstEstimate.postData.items.length !== 1) {
    throw new Error(
      `Expected exactly one estimate item, got ${firstEstimate.postData.items.length}`,
    );
  }
  if (firstEstimate.postData.items[0].quantity !== 5) {
    throw new Error(
      `Expected quantity 5 in estimate payload, got ${firstEstimate.postData.items[0].quantity}`,
    );
  }
  const firstMenuId = firstEstimate.postData.items[0].menu_id;

  const errorAlert = page.locator('[aria-label="Stock estimation"] [role="alert"]');
  if (await errorAlert.isVisible()) {
    throw new Error(`Estimation error alert: ${await errorAlert.innerText()}`);
  }

  await quantityInput.fill("10");
  await page.waitForTimeout(DEBOUNCE_MS);
  await waitForEstimateBadge(page);

  const quantityEstimate = estimatePosts.at(-1);
  if (quantityEstimate?.postData?.items?.[0]?.quantity !== 10) {
    throw new Error("Estimate POST after quantity change did not send quantity 10");
  }

  await selectMenuAtRow(page, 0, "QA Mie Goreng");
  await page.waitForTimeout(DEBOUNCE_MS);
  await waitForEstimateBadge(page);

  const menuEstimate = estimatePosts.at(-1);
  const secondMenuId = menuEstimate?.postData?.items?.[0]?.menu_id;
  if (!secondMenuId || secondMenuId === firstMenuId) {
    throw new Error("Estimate POST after menu change did not use a different menu_id");
  }

  await page.getByRole("button", { name: "Add line item" }).click();
  await page.waitForTimeout(DEBOUNCE_MS);
  await page.getByRole("button", { name: "Remove item 2" }).click();
  await page.waitForTimeout(DEBOUNCE_MS);
  await waitForEstimateBadge(page);

  const afterRemoveEstimate = estimatePosts.at(-1);
  const afterRemoveItems = parseEstimateBody(afterRemoveEstimate?.postData);
  if (!afterRemoveItems || afterRemoveItems.length !== 1) {
    throw new Error(
      "After add/remove second row, estimate payload should still have one item",
    );
  }
  if (afterRemoveItems[0].quantity !== 10) {
    throw new Error(
      "After add/remove second row, estimate should keep original quantity 10",
    );
  }

  await browser.close();
  console.log(`Browser smoke passed (${estimatePosts.length} estimate POST(s))`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
