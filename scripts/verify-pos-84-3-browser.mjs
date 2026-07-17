#!/usr/bin/env node
/**
 * Browser smoke for POS-84-3: cooking measurements on food supply form.
 * Mocks admin food-supplies API when NEXT_PUBLIC_API_URL is not reachable.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const OPERATIONAL_EMAIL =
  process.env.TEST_OPERATIONAL_EMAIL ?? "operation-test@cymonevo.com";
const OPERATIONAL_PASSWORD =
  process.env.TEST_OPERATIONAL_PASSWORD ?? "LunaTesting123!";

const supplyId = "fs-verify-84-3";

function makeJwt(claims) {
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

function buildSupply(overrides = {}) {
  return {
    id: supplyId,
    title: "QA Cooking Supply",
    description: "For POS-84-3 verification",
    stock_quantity: "1000",
    unit: "gr",
    created_at: "2026-03-01T08:00:00Z",
    updated_at: "2026-03-01T08:00:00Z",
    manual_edit_history: [],
    cooking_measurements: [],
    ...overrides,
  };
}

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
              id: "user-op",
              email: OPERATIONAL_EMAIL,
              name: "Ops User",
              roles: ["operational"],
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
    }

    if (pathname.includes("/api/v1/users/user-op") && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: {
            id: "user-op",
            email: OPERATIONAL_EMAIL,
            name: "Ops User",
            roles: ["operational"],
            merchant_id: "merchant-1",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        }),
      );
    }

    if (pathname.startsWith("/api/admin/food-supplies")) {
      if (method === "GET" && pathname === `/api/admin/food-supplies/${supplyId}`) {
        return route.fulfill(
          json({
            success: true,
            data: buildSupply({
              title: state.title,
              stock_quantity: String(state.stockQuantity),
              unit: state.unit,
              cooking_measurements: state.cookingMeasurements,
            }),
          }),
        );
      }

      if (method === "GET" && pathname === "/api/admin/food-supplies") {
        return route.fulfill(
          json({
            success: true,
            data: [
              buildSupply({
                title: state.title,
                stock_quantity: String(state.stockQuantity),
                unit: state.unit,
                cooking_measurements: state.cookingMeasurements,
              }),
            ],
            meta: { page: 1, per_page: 10, total: 1 },
          }),
        );
      }

      if (method === "PUT" && pathname === `/api/admin/food-supplies/${supplyId}`) {
        const payload = request.postDataJSON();
        state.title = payload.title ?? state.title;
        state.stockQuantity = Number(payload.stock_quantity);
        state.unit = payload.unit ?? state.unit;
        if (payload.cooking_measurements) {
          state.cookingMeasurements = payload.cooking_measurements.map(
            (measurement, index) => ({
              id: measurement.id ?? `cm-${index + 1}`,
              name: measurement.name,
              conversion_quantity: String(measurement.conversion_quantity),
            }),
          );
        } else {
          state.cookingMeasurements = [];
        }
        return route.fulfill(
          json({
            success: true,
            data: buildSupply({
              title: state.title,
              stock_quantity: String(state.stockQuantity),
              unit: state.unit,
              cooking_measurements: state.cookingMeasurements,
            }),
          }),
        );
      }

      if (method === "POST" && pathname === "/api/admin/food-supplies") {
        const payload = request.postDataJSON();
        state.createdSupply = {
          id: "fs-created-84-3",
          title: payload.title,
          stock_quantity: String(payload.stock_quantity),
          unit: payload.unit,
          cooking_measurements: (payload.cooking_measurements ?? []).map(
            (measurement, index) => ({
              id: `cm-new-${index + 1}`,
              name: measurement.name,
              conversion_quantity: String(measurement.conversion_quantity),
            }),
          ),
        };
        return route.fulfill(
          json(
            {
              success: true,
              data: buildSupply({
                id: "fs-created-84-3",
                title: payload.title,
                stock_quantity: String(payload.stock_quantity),
                unit: payload.unit,
                cooking_measurements: state.createdSupply.cooking_measurements,
              }),
            },
            201,
          ),
        );
      }

      if (method === "DELETE" && pathname === `/api/admin/food-supplies/${supplyId}`) {
        return route.fulfill({ status: 204, body: "" });
      }
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

async function openCreateDialog(page) {
  await page.goto(`${WEB_BASE}/admin/food-supplies`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "Add supply" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("heading", { name: "Cooking measurements" }).waitFor({
    timeout: 10000,
  });
  return dialog;
}

async function openEditDialog(page) {
  await page.goto(`${WEB_BASE}/admin/food-supplies`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector("text=QA Cooking Supply", { timeout: 15000 });
  await page.getByLabel("Edit food supply").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("heading", { name: "Cooking measurements" }).waitFor({
    timeout: 10000,
  });
  return dialog;
}

async function main() {
  const state = {
    title: "QA Cooking Supply",
    stockQuantity: 1000,
    unit: "gr",
    cookingMeasurements: [],
    createdSupply: null,
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await installApiMocks(page, state);
  await login(page);

  // 1. Create food supply with cooking measurements
  let dialog = await openCreateDialog(page);
  await dialog.getByLabel("Title").fill("New Flour");
  await dialog.getByLabel("Stock quantity").fill("1000");
  await dialog.getByLabel("Unit").selectOption("gr");
  await dialog.getByRole("button", { name: "Add measurement" }).click();
  await dialog.getByLabel("Name").fill("Tablespoon");
  await dialog.getByLabel("Conversion").fill("10");
  await dialog.getByRole("button", { name: "Add measurement" }).click();
  const nameInputs = dialog.getByLabel("Name");
  const conversionInputs = dialog.getByLabel("Conversion");
  await nameInputs.nth(1).fill("Teaspoon");
  await conversionInputs.nth(1).fill("3.33");
  const submitButton = dialog.locator('button[type="submit"]');
  await submitButton.click({ force: true });
  await page.waitForTimeout(500);

  if (!state.createdSupply) {
    throw new Error("Create API was not called");
  }
  if (state.createdSupply.cooking_measurements.length !== 2) {
    throw new Error("Expected two cooking measurements on create");
  }
  if (
    state.createdSupply.cooking_measurements[0].name !== "Tablespoon" ||
    state.createdSupply.cooking_measurements[0].conversion_quantity !== "10" ||
    state.createdSupply.cooking_measurements[1].name !== "Teaspoon" ||
    state.createdSupply.cooking_measurements[1].conversion_quantity !== "3.33"
  ) {
    throw new Error("Cooking measurements payload mismatch on create");
  }
  console.log("PASS: Create food supply with cooking measurements in UI");

  // Seed edit state for remaining checks
  state.cookingMeasurements = [
    {
      id: "cm-1",
      name: "Tablespoon",
      conversion_quantity: "10",
    },
    {
      id: "cm-2",
      name: "Teaspoon",
      conversion_quantity: "3.33",
    },
  ];

  // 2. Edit cooking measurement conversion
  dialog = await openEditDialog(page);
  const editConversionInputs = dialog.getByLabel("Conversion");
  await editConversionInputs.first().fill("12");
  const saveButton = dialog.locator('button[type="submit"]');
  await saveButton.click({ force: true });
  await page.waitForTimeout(500);
  if (state.cookingMeasurements[0].conversion_quantity !== "12") {
    throw new Error("Expected Tablespoon conversion to update to 12");
  }

  dialog = await openEditDialog(page);
  await dialog
    .getByLabel("Conversion")
    .first()
    .waitFor({ state: "visible" });
  const savedConversion = await dialog.getByLabel("Conversion").first().inputValue();
  if (savedConversion !== "12") {
    throw new Error(`Expected reloaded Tablespoon conversion 12, got ${savedConversion}`);
  }
  console.log("PASS: Edit cooking measurement conversion");

  // 3. Remove cooking measurement row
  dialog = await openEditDialog(page);
  await dialog.getByLabel("Remove cooking measurement").first().click();
  const saveAfterRemove = dialog.locator('button[type="submit"]');
  await saveAfterRemove.click({ force: true });
  await page.waitForTimeout(500);
  if (state.cookingMeasurements.length !== 1) {
    throw new Error("Expected one cooking measurement after remove");
  }
  if (state.cookingMeasurements[0].name !== "Teaspoon") {
    throw new Error("Expected only Teaspoon to remain after remove");
  }

  dialog = await openEditDialog(page);
  if (await dialog.getByLabel("Name").count() !== 1) {
    throw new Error("Expected one measurement row after reload");
  }
  console.log("PASS: Remove cooking measurement row");

  // 4. Validation prevents invalid conversion
  dialog = await openEditDialog(page);
  await dialog.getByRole("button", { name: "Add measurement" }).click();
  const invalidNameInputs = dialog.getByLabel("Name");
  const invalidConversionInputs = dialog.getByLabel("Conversion");
  await invalidNameInputs.last().fill("");
  await invalidConversionInputs.last().fill("0");
  const saveInvalid = dialog.locator('button[type="submit"]');
  await saveInvalid.click({ force: true });
  await page.waitForTimeout(300);
  if (!(await dialog.getByText("Conversion must be greater than 0").isVisible())) {
    throw new Error("Expected inline validation for zero conversion");
  }
  console.log("PASS: Validation prevents invalid conversion");

  await browser.close();
  console.log("All POS-84-3 browser checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
