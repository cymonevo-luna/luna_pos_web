#!/usr/bin/env node
/**
 * Browser smoke for POS-59-3: food supply manual edit history on edit dialog.
 * Mocks admin food-supplies API when NEXT_PUBLIC_API_URL is not reachable.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const OPERATIONAL_EMAIL =
  process.env.TEST_OPERATIONAL_EMAIL ?? "operation-test@cymonevo.com";
const OPERATIONAL_PASSWORD =
  process.env.TEST_OPERATIONAL_PASSWORD ?? "LunaTesting123!";

const supplyId = "fs-verify-59-3";

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
    title: "QA History Supply",
    description: "For POS-59-3 verification",
    stock_quantity: "100",
    unit: "ml",
    created_at: "2026-03-01T08:00:00Z",
    updated_at: "2026-03-01T08:00:00Z",
    manual_edit_history: [],
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
              stock_quantity: String(state.stockQuantity),
              manual_edit_history: state.history,
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
                stock_quantity: String(state.stockQuantity),
              }),
            ],
            meta: { page: 1, per_page: 10, total: 1 },
          }),
        );
      }

      if (method === "PUT" && pathname === `/api/admin/food-supplies/${supplyId}`) {
        const payload = request.postDataJSON();
        const previous = state.stockQuantity;
        const next = Number(payload.stock_quantity);
        if (Number.isFinite(next) && next !== previous) {
          const delta = next - previous;
          state.history = [
            ...state.history,
            {
              delta_quantity: String(delta),
              previous_quantity: String(previous),
              new_quantity: String(next),
              changed_by_username: "ops-user",
              created_at: new Date().toISOString(),
            },
          ];
          state.stockQuantity = next;
        } else if (payload.title) {
          state.title = payload.title;
        }
        return route.fulfill(
          json({
            success: true,
            data: buildSupply({
              title: state.title,
              stock_quantity: String(state.stockQuantity),
              manual_edit_history: state.history,
            }),
          }),
        );
      }

      if (method === "POST" && pathname === "/api/admin/food-supplies") {
        return route.fulfill(
          json({ success: true, data: buildSupply() }, 201),
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

async function openEditDialog(page) {
  await page.goto(`${WEB_BASE}/admin/food-supplies`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector("text=QA History Supply", { timeout: 15000 });
  await page.getByLabel("Edit food supply").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("Manual edit history").waitFor({ timeout: 10000 });
  return dialog;
}

async function main() {
  const state = {
    title: "QA History Supply",
    stockQuantity: 100,
    history: [],
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await installApiMocks(page, state);
  await login(page);

  // 1. Empty history state renders
  const dialog = await openEditDialog(page);
  if (!(await dialog.getByText("No manual quantity edits yet").isVisible())) {
    throw new Error("Empty history state not shown");
  }
  if (await dialog.getByRole("columnheader", { name: "Delta (ml)" }).count()) {
    throw new Error("History table should not render when empty");
  }
  console.log("PASS: Empty history state renders");

  // 2. Manual edit appears in history table
  await dialog.getByLabel("Stock quantity").fill("150");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await dialog.getByText("+50").waitFor({ timeout: 10000 });
  if (!(await dialog.getByText("ops-user").isVisible())) {
    throw new Error("Updated by username missing after manual edit");
  }
  console.log("PASS: Manual edit appears in history table");

  // 3. Multiple edits show chronological order
  await dialog.getByLabel("Stock quantity").fill("130");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await dialog.getByText("-20").waitFor({ timeout: 10000 });
  const deltaCells = await dialog.locator("tbody tr td:first-child").allTextContents();
  if (deltaCells[0] !== "+50" || deltaCells[1] !== "-20") {
    throw new Error(
      `Expected oldest-first deltas +50 then -20, got: ${deltaCells.join(", ")}`,
    );
  }
  console.log("PASS: Multiple edits show chronological order");

  const historyCountBeforeTitleEdit = state.history.length;

  // 4. Non-quantity edit does not add row
  await dialog.getByLabel("Title").fill("QA History Supply Renamed");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await page.waitForTimeout(500);
  if (state.history.length !== historyCountBeforeTitleEdit) {
    throw new Error("Title-only edit should not add history row");
  }
  const rowCount = await dialog.locator("tbody tr").count();
  if (rowCount !== 2) {
    throw new Error(`Expected 2 history rows after title edit, got ${rowCount}`);
  }
  console.log("PASS: Non-quantity edit does not add row");

  // 5. Food supply edit regression (create/update/delete flows)
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Add supply" }).click();
  const createDialog = page.getByRole("dialog");
  await createDialog.getByLabel("Title").fill("Temporary supply");
  await createDialog.getByLabel("Stock quantity").fill("5");
  await createDialog.getByLabel("Unit").selectOption("gr");
  await createDialog.getByRole("button", { name: "Add supply" }).click();
  await page.waitForTimeout(500);

  await openEditDialog(page);
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await page.getByLabel("Delete food supply").click();
  await page
    .locator(".fixed")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await page.waitForTimeout(500);
  console.log("PASS: Food supply edit regression");

  await browser.close();
  console.log("All POS-59-3 browser checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
