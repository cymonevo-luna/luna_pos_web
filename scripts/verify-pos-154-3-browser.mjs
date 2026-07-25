#!/usr/bin/env node
/**
 * Browser verification for POS-154-3: purchase create and batch transaction date.
 * Mocks API routes so it runs without luna_pos_service.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const OPERATIONAL_EMAIL =
  process.env.TEST_OPERATIONAL_EMAIL ?? "operation-test@cymonevo.com";
const OPERATIONAL_PASSWORD =
  process.env.TEST_OPERATIONAL_PASSWORD ?? "LunaTesting123!";

function makeJwt(claims = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url",
  );
  const body = Buffer.from(
    JSON.stringify({
      uid: "user-op",
      email: OPERATIONAL_EMAIL,
      roles: ["operational"],
      merchant_id: "merchant-1",
      typ: "access",
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...claims,
    }),
  ).toString("base64url");
  return `${header}.${body}.sig`;
}

function json(body, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

function todayWIB() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function startOfDayWibIso(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, -7, 0, 0, 0)).toISOString();
}

function threeDaysAgoWIB() {
  const today = todayWIB();
  const anchor = new Date(`${today}T00:00:00+07:00`);
  anchor.setUTCDate(anchor.getUTCDate() - 3);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(anchor);
}

async function setupApiMocks(page) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;

    if (pathname.endsWith("/api/v1/auth/login") && method === "POST") {
      await route.fulfill(
        json({
          success: true,
          data: {
            user: {
              id: "user-op",
              email: OPERATIONAL_EMAIL,
              name: "Operational Test",
              roles: ["operational"],
              features: ["purchases.manage"],
              merchant_id: "merchant-1",
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
            merchant: {
              id: "merchant-1",
              name: "Test Merchant",
            },
            tokens: {
              access_token: makeJwt({ typ: "access" }),
              refresh_token: makeJwt({ typ: "refresh" }),
              expires_in: 3600,
              refresh_expires_in: 86400,
            },
          },
        }),
      );
      return;
    }

    if (pathname.includes("/api/v1/users/") && method === "GET") {
      await route.fulfill(
        json({
          success: true,
          data: {
            id: "user-op",
            email: OPERATIONAL_EMAIL,
            name: "Operational Test",
            roles: ["operational"],
            features: ["purchases.manage"],
            merchant_id: "merchant-1",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        }),
      );
      return;
    }

    if (pathname.endsWith("/api/v1/auth/refresh") && method === "POST") {
      await route.fulfill(
        json({
          success: true,
          data: {
            access_token: makeJwt({ typ: "access" }),
            refresh_token: makeJwt({ typ: "refresh" }),
            expires_in: 3600,
            refresh_expires_in: 86400,
          },
        }),
      );
      return;
    }

    if (pathname.includes("/api/admin/suppliers/sup-a") && method === "GET") {
      await route.fulfill(
        json({
          success: true,
          data: {
            id: "sup-a",
            name: "Supplier A",
            phone_number: "08123456789",
            address: "Address",
            supports_delivery: false,
            delivery_cost: null,
            price_quotes: [
              {
                id: "price-1",
                food_supply_id: "fs-meat",
                food_supply_title: "Meat",
                unit: "gr",
                price_amount: 140000,
                price_quantity: 1000,
              },
            ],
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        }),
      );
      return;
    }

    if (pathname.includes("/api/admin/suppliers") && method === "GET") {
      await route.fulfill(
        json({
          success: true,
          data: [
            {
              id: "sup-a",
              name: "Supplier A",
              phone_number: "08123456789",
              address: "Address",
              supports_delivery: false,
              delivery_cost: null,
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
          ],
          meta: { page: 1, per_page: 20, total: 1 },
        }),
      );
      return;
    }

    if (pathname.includes("/api/admin/food-supplies") && method === "GET") {
      await route.fulfill(
        json({
          success: true,
          data: [
            {
              id: "fs-rice",
              title: "Rice",
              unit: "gr",
              stock_quantity: 1000,
              has_supplier_price: true,
              description: null,
              manual_edit_history: [],
              cooking_measurements: [],
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
          ],
          meta: { page: 1, per_page: 20, total: 1 },
        }),
      );
      return;
    }

    if (pathname.endsWith("/api/admin/purchase-requests/suggest") && method === "POST") {
      await route.fulfill(
        json({
          success: true,
          data: {
            items: [
              {
                food_supply_id: "fs-rice",
                food_supply_title: "Rice",
                quantity: "2",
                unit: "gr",
                has_supplier_price: true,
                selected_supplier_id: "sup-a",
                selected_supplier_name: "Supplier A",
                price_amount: "100000",
                price_quantity: "1000",
                unit_price: "100",
                line_estimated_amount: "200",
                all_supplier_quotes: [
                  {
                    supplier_id: "sup-a",
                    supplier_name: "Supplier A",
                    price_amount: "100000",
                    price_quantity: "1000",
                    unit_price: "100",
                  },
                ],
              },
            ],
            grouped_by_supplier: [],
          },
        }),
      );
      return;
    }

    if (pathname.endsWith("/api/admin/purchase-requests/batch") && method === "POST") {
      const body = request.postDataJSON();
      await route.fulfill(
        json({
          success: true,
          data: {
            purchase_requests: [
              {
                id: "pr-batch-1",
                supplier_id: "sup-a",
                supplier_name: "Supplier A",
                supplier_contact_info: "08123456789",
                status: "PENDING",
                notes: null,
                items: [],
                total_estimated_amount: "200",
                transaction_date: body.groups?.[0]?.transaction_date,
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:00:00Z",
              },
            ],
          },
        }),
      );
      return;
    }

    if (pathname.endsWith("/api/admin/purchase-requests") && method === "POST") {
      const body = request.postDataJSON();
      await route.fulfill(
        json({
          success: true,
          data: {
            id: "pr-create-1",
            supplier_id: body.supplier_id,
            supplier_name: "Supplier A",
            supplier_contact_info: "08123456789",
            status: "PENDING",
            notes: body.notes ?? null,
            items: [],
            total_estimated_amount: "140000",
            transaction_date: body.transaction_date,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        }),
      );
      return;
    }

    await route.fulfill(json({ success: true, data: null }));
  });
}

async function loginOperational(page) {
  await page.goto(`${WEB_BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', OPERATIONAL_EMAIL);
  await page.fill('input[type="password"]', OPERATIONAL_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 15000 });
}

async function selectSupplier(page) {
  await page.getByLabel("Supplier").click();
  await page.getByRole("option", { name: /Supplier A/ }).click();
}

async function selectIngredient(page, label = "Ingredient 1") {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.getByRole("option", { name: /Rice/ }).click();
}

async function main() {
  const results = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await setupApiMocks(page);
  await loginOperational(page);

  // 1. Create form shows default transaction date
  await page.goto(`${WEB_BASE}/admin/purchases/new`, { waitUntil: "networkidle" });
  const dateInput = page.getByTestId("purchase-transaction-date-input");
  await dateInput.waitFor({ timeout: 15000 });
  const defaultDate = await dateInput.inputValue();
  if (defaultDate !== todayWIB()) {
    throw new Error(
      `Expected default transaction date ${todayWIB()}, got ${defaultDate}`,
    );
  }
  results.push("1. Create form shows default transaction date — PASS");

  // 2. Create submits transaction_date to API
  const createPosts = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/api/admin/purchase-requests")
    ) {
      createPosts.push(request.postDataJSON());
    }
  });

  await selectSupplier(page);
  await page.getByRole("button", { name: "Add line item" }).click();
  await page.getByLabel("Item 1", { exact: true }).selectOption("fs-meat");
  await page.getByLabel("Quantity").fill("1000");
  const pastDate = threeDaysAgoWIB();
  await dateInput.fill(pastDate);
  await page.getByRole("button", { name: "Create purchase request" }).click();
  await page.waitForURL(/\/admin\/purchases\/pr-create-1/, { timeout: 15000 });
  const createBody = createPosts.at(-1);
  if (!createBody?.transaction_date) {
    throw new Error("Create POST missing transaction_date");
  }
  if (createBody.transaction_date !== startOfDayWibIso(pastDate)) {
    throw new Error(
      `Expected transaction_date ${startOfDayWibIso(pastDate)}, got ${createBody.transaction_date}`,
    );
  }
  results.push("2. Create submits transaction_date to API — PASS");

  // 3. Future date blocked in UI
  await page.goto(`${WEB_BASE}/admin/purchases/new`, { waitUntil: "networkidle" });
  await selectSupplier(page);
  await page.getByRole("button", { name: "Add line item" }).click();
  await page.getByLabel("Item 1", { exact: true }).selectOption("fs-meat");
  await page.getByLabel("Quantity").fill("1000");
  await page.getByTestId("purchase-transaction-date-input").fill("2099-01-01");
  await page.getByRole("button", { name: "Create purchase request" }).click();
  await page.getByText("Transaction date cannot be in the future").waitFor({
    timeout: 5000,
  });
  results.push("3. Future date blocked in UI — PASS");

  // 4. Batch create includes transaction_date
  const batchPosts = [];
  page.removeAllListeners("request");
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/api/admin/purchase-requests/batch")
    ) {
      batchPosts.push(request.postDataJSON());
    }
  });

  await page.goto(`${WEB_BASE}/admin/purchases/smart`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /add ingredient/i }).click();
  await selectIngredient(page);
  await page.locator('input[type="number"]').first().fill("2");
  await page.getByTestId("smart-purchase-continue").click();
  await page.getByTestId("smart-purchase-review-step").waitFor({ timeout: 15000 });
  const batchPastDate = threeDaysAgoWIB();
  await page.getByTestId("smart-purchase-transaction-date-input").fill(batchPastDate);
  await page.getByTestId("smart-purchase-confirm").click();
  await page.waitForTimeout(1500);
  const batchBody = batchPosts.at(-1);
  if (!batchBody?.groups?.length) {
    throw new Error("Batch POST missing groups");
  }
  for (const group of batchBody.groups) {
    if (!group.transaction_date) {
      throw new Error("Batch group missing transaction_date");
    }
    if (group.transaction_date !== startOfDayWibIso(batchPastDate)) {
      throw new Error(
        `Expected group transaction_date ${startOfDayWibIso(batchPastDate)}, got ${group.transaction_date}`,
      );
    }
  }
  results.push("4. Batch create includes transaction_date — PASS");

  // 5. Create without changing date still succeeds
  const defaultCreatePosts = [];
  page.removeAllListeners("request");
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/api/admin/purchase-requests")
    ) {
      defaultCreatePosts.push(request.postDataJSON());
    }
  });

  await page.goto(`${WEB_BASE}/admin/purchases/new`, { waitUntil: "networkidle" });
  await selectSupplier(page);
  await page.getByRole("button", { name: "Add line item" }).click();
  await page.getByLabel("Item 1", { exact: true }).selectOption("fs-meat");
  await page.getByLabel("Quantity").fill("1000");
  await page.getByRole("button", { name: "Create purchase request" }).click();
  await page.waitForURL(/\/admin\/purchases\/pr-create-1/, { timeout: 15000 });
  const defaultBody = defaultCreatePosts.at(-1);
  if (!defaultBody?.transaction_date) {
    throw new Error("Default create POST missing transaction_date");
  }
  if (defaultBody.transaction_date !== startOfDayWibIso(todayWIB())) {
    throw new Error(
      `Expected default transaction_date ${startOfDayWibIso(todayWIB())}, got ${defaultBody.transaction_date}`,
    );
  }
  results.push("5. Create without changing date still succeeds — PASS");

  await browser.close();

  console.log("POS-154-3 browser verification:");
  for (const line of results) {
    console.log(`  ${line}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
