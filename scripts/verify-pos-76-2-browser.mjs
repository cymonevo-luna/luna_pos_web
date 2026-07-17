#!/usr/bin/env node
/**
 * Browser verification for POS-76-2: supplier price delete on supplier detail UI.
 *
 * Mocked mode (default) exercises delete/create/edit flows without luna_pos_service.
 * Live mode requires API with the POS-76 FK migration fix deployed.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const OPERATIONAL_EMAIL =
  process.env.TEST_OPERATIONAL_EMAIL ?? "operation-test@cymonevo.com";
const OPERATIONAL_PASSWORD =
  process.env.TEST_OPERATIONAL_PASSWORD ?? "LunaTesting123!";
const MOCK_API = !["0", "false", "no"].includes(
  String(process.env.MOCK_API ?? "1").toLowerCase(),
);

const SUPPLIER_ID = "sup-verify-76-2";
const PRICE_ID = "price-verify-76-2";
const PRICE_USED_ID = "price-used-verify-76-2";
const OPERATIONAL_USER_ID = "user-operational-verify-76-2";

function makeJwt(claims = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url",
  );
  const body = Buffer.from(
    JSON.stringify({
      uid: OPERATIONAL_USER_ID,
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

function buildSupplier(priceQuotes) {
  return {
    id: SUPPLIER_ID,
    name: "POS-76-2 Verify Supplier",
    phone_number: "08123456789",
    address: "Jl. Verify 76",
    supports_delivery: false,
    delivery_cost: null,
    price_quotes: priceQuotes,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

const initialPrices = [
  {
    id: PRICE_ID,
    food_supply_id: "fs-1",
    food_supply_title: "Rice",
    price_amount: 140000,
    price_quantity: 1000,
    unit: "gr",
    unit_price: 140,
  },
  {
    id: PRICE_USED_ID,
    food_supply_id: "fs-2",
    food_supply_title: "Sugar",
    price_amount: 12000,
    price_quantity: 1000,
    unit: "gr",
    unit_price: 12,
  },
];

async function installApiMocks(page, state) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;

    if (pathname.endsWith("/api/v1/auth/login") && method === "POST") {
      return route.fulfill(
        json({
          success: true,
          data: {
            user: {
              id: OPERATIONAL_USER_ID,
              email: OPERATIONAL_EMAIL,
              name: "Operational User",
              roles: ["operational"],
              merchant_id: "merchant-1",
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
            merchant: { id: "merchant-1", name: "Test Merchant" },
            tokens: {
              access_token: makeJwt({ typ: "access" }),
              refresh_token: makeJwt({ typ: "refresh" }),
              expires_in: 3600,
              refresh_expires_in: 86400,
            },
          },
        }),
      );
    }

    if (pathname.includes(`/api/v1/users/${OPERATIONAL_USER_ID}`) && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: {
            id: OPERATIONAL_USER_ID,
            email: OPERATIONAL_EMAIL,
            name: "Operational User",
            roles: ["operational"],
            merchant_id: "merchant-1",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        }),
      );
    }

    if (
      pathname === `/api/admin/suppliers/${SUPPLIER_ID}` &&
      method === "GET"
    ) {
      const visible = state.prices.filter((p) => !state.deletedPriceIds.has(p.id));
      return route.fulfill(
        json({ success: true, data: buildSupplier(visible) }),
      );
    }

    const priceDeleteMatch = pathname.match(/^\/api\/admin\/supplier-prices\/([^/]+)$/);
    if (priceDeleteMatch && method === "DELETE") {
      const id = priceDeleteMatch[1];
      state.deletedPriceIds.add(id);
      state.deleteCalls.push(id);
      return route.fulfill({ status: 204, body: "" });
    }

    if (
      pathname === `/api/admin/suppliers/${SUPPLIER_ID}/prices` &&
      method === "POST"
    ) {
      const body = request.postDataJSON();
      const created = {
        id: "price-created-76-2",
        food_supply_id: body.food_supply_id,
        food_supply_title: "Milk",
        price_amount: body.price_amount,
        price_quantity: body.price_quantity,
        unit: "ml",
        unit_price: body.price_amount / body.price_quantity,
      };
      state.prices.push(created);
      return route.fulfill(json({ success: true, data: created }));
    }

    const priceUpdateMatch = pathname.match(/^\/api\/admin\/supplier-prices\/([^/]+)$/);
    if (priceUpdateMatch && method === "PUT") {
      const id = priceUpdateMatch[1];
      const body = request.postDataJSON();
      const index = state.prices.findIndex((p) => p.id === id);
      if (index >= 0) {
        state.prices[index] = {
          ...state.prices[index],
          price_amount: body.price_amount,
          price_quantity: body.price_quantity,
          unit_price: body.price_amount / body.price_quantity,
        };
        return route.fulfill(
          json({ success: true, data: state.prices[index] }),
        );
      }
    }

    if (pathname.startsWith("/api/admin/food-supplies") && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: [
            {
              id: "fs-3",
              title: "Milk",
              unit: "ml",
              stock_quantity: 500,
            },
          ],
          meta: { page: 1, per_page: 10, total: 1 },
        }),
      );
    }

    return route.continue();
  });
}

async function login(page) {
  await page.goto(`${WEB_BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', OPERATIONAL_EMAIL);
  await page.fill('input[type="password"]', OPERATIONAL_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin\/(?!login)/, { timeout: 15000 });
}

async function openSupplierDetail(page) {
  await page.goto(`${WEB_BASE}/admin/suppliers/${SUPPLIER_ID}`, {
    waitUntil: "networkidle",
  });
  await page.getByText("POS-76-2 Verify Supplier").waitFor({ timeout: 15000 });
}

async function runMockedFlow(page, state) {
  await installApiMocks(page, state);
  await login(page);
  await openSupplierDetail(page);

  // 1. Delete supplier price happy path
  await page.getByLabel("Delete price quote").first().click();
  const deleteResponse = page.waitForResponse(
    (res) =>
      res.url().includes(`/api/admin/supplier-prices/${PRICE_ID}`) &&
      res.request().method() === "DELETE",
  );
  const refetchResponse = page.waitForResponse(
    (res) =>
      res.url().includes(`/api/admin/suppliers/${SUPPLIER_ID}`) &&
      res.request().method() === "GET",
  );
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await deleteResponse;
  await refetchResponse;
  await page.locator("tbody tr", { hasText: "Sugar" }).first().waitFor({
    timeout: 10000,
  });
  if ((await page.locator("tbody tr", { hasText: "Rice" }).count()) > 0) {
    throw new Error("Rice price still visible after delete");
  }
  if (!state.deleteCalls.includes(PRICE_ID)) {
    throw new Error(`Expected DELETE for ${PRICE_ID}, got ${state.deleteCalls.join(",")}`);
  }
  console.log("PASS: Delete supplier price from UI happy path");

  // 2. Deleted price absent after page refresh
  const supplierGet = page.waitForResponse(
    (res) =>
      res.url().includes(`/api/admin/suppliers/${SUPPLIER_ID}`) &&
      res.request().method() === "GET",
  );
  await page.reload({ waitUntil: "networkidle" });
  await supplierGet;
  await page.getByText("POS-76-2 Verify Supplier").waitFor();
  const riceRows = page.locator("tbody tr", { hasText: "Rice" });
  if ((await riceRows.count()) > 0) {
    throw new Error(
      `Deleted Rice price reappeared after refresh (deleted=${[...state.deletedPriceIds].join(",")})`,
    );
  }
  await page.getByRole("cell", { name: "Sugar" }).waitFor();
  console.log("PASS: Deleted price absent after page refresh");

  // 3. Delete price previously used in purchase request (same 204 contract)
  await page.getByLabel("Delete price quote").click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByText("No price quotes yet.").waitFor({ timeout: 10000 });
  if (!state.deleteCalls.includes(PRICE_USED_ID)) {
    throw new Error(
      `Expected DELETE for used price ${PRICE_USED_ID}, got ${state.deleteCalls.join(",")}`,
    );
  }
  console.log("PASS: Delete price previously used in purchase request");

  // Re-seed prices for create/edit regression
  state.deletedPriceIds.clear();
  state.prices = [...initialPrices];

  await page.reload({ waitUntil: "networkidle" });
  await page.locator("tbody tr", { hasText: "Rice" }).first().waitFor();

  // 4. Create and edit supplier price UI regression
  await page.getByRole("button", { name: "Add price" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("Select a food supply").click();
  await dialog.getByRole("button", { name: /Milk/ }).click();
  await dialog.getByLabel("Price amount (Rp)").fill("25000");
  await dialog.getByLabel("Price quantity").fill("500");
  await dialog.getByRole("button", { name: "Add price" }).click();
  await page.getByRole("cell", { name: "Milk" }).waitFor({ timeout: 10000 });

  await page.getByLabel("Edit price quote").first().click();
  const editDialog = page.getByRole("dialog");
  await editDialog.getByLabel("Price amount (Rp)").fill("150000");
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("cell", { name: "Rp 150.000" }).first().waitFor({
    timeout: 10000,
  });
  console.log("PASS: Create and edit supplier price UI regression");
}

async function main() {
  const state = {
    prices: [...initialPrices],
    deletedPriceIds: new Set(),
    deleteCalls: [],
  };

  console.log(
    `POS-76-2 browser verification (MOCK_API=${MOCK_API}, WEB_BASE=${WEB_BASE})`,
  );

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  if (MOCK_API) {
    await runMockedFlow(page, state);
  } else {
    throw new Error(
      "Live browser mode not implemented — set MOCK_API=1 or run against API manually.",
    );
  }

  await browser.close();
  console.log("All POS-76-2 browser checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
