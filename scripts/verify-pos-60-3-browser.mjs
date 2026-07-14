#!/usr/bin/env node
/**
 * Browser verification for POS-60-3 / POS-62-2: admin-only production request
 * detail is read-only with delete available.
 *
 * Environment:
 *   WEB_BASE              — Next.js app URL (default http://localhost:3000)
 *   NEXT_PUBLIC_API_URL   — API base URL (default http://localhost:8087)
 *   TEST_ADMIN_EMAIL      — admin login email (default admin-test@cymonevo.com)
 *   TEST_ADMIN_PASSWORD   — admin login password (default LunaTesting123!)
 *   MOCK_API              — "0" / "false" / "no" for live stack; otherwise mocked (default)
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "admin-test@cymonevo.com";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "LunaTesting123!";
const MOCK_API = !["0", "false", "no"].includes(
  String(process.env.MOCK_API ?? "1").toLowerCase(),
);

const REQUESTED_ID = "prod-verify-60-3-requested";
const ACCEPTED_ID = "prod-verify-60-3-accepted";
const ADMIN_USER_ID = "user-admin-verify-60-3";

const lineStockEstimation = {
  has_formula: true,
  is_fully_producible: true,
  limiting_ingredient_title: "Rice",
  ingredients: [
    {
      food_supply_id: "fs-1",
      food_supply_title: "Rice",
      unit: "gr",
      quantity_per_unit: 200,
      required_quantity: 2000,
      current_stock_quantity: 5000,
      remaining_after: 3000,
      is_sufficient: true,
    },
  ],
};

function makeJwt(claims = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url",
  );
  const body = Buffer.from(
    JSON.stringify({
      uid: ADMIN_USER_ID,
      email: ADMIN_EMAIL,
      roles: ["admin"],
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

function buildProductionRequest(id, overrides = {}) {
  const status = overrides.status ?? "REQUESTED";
  const isAccepted = status === "ACCEPTED";
  return {
    id,
    status,
    is_fully_producible: true,
    notes: "Rush order for POS-60-3 verification",
    created_by_username: "manager1",
    status_history: [
      {
        id: `hist-${id}-1`,
        from_status: null,
        to_status: "REQUESTED",
        changed_by_username: "manager1",
        created_at: "2026-01-01T00:00:00Z",
      },
      ...(isAccepted
        ? [
            {
              id: `hist-${id}-2`,
              from_status: "REQUESTED",
              to_status: "ACCEPTED",
              changed_by_username: "ops1",
              created_at: "2026-01-02T00:00:00Z",
            },
          ]
        : []),
    ],
    aggregated_ingredients: [
      {
        food_supply_id: "fs-1",
        food_supply_title: "Rice",
        unit: "gr",
        required_quantity: 2000,
        current_stock_quantity: 5000,
        remaining_after: 3000,
        is_sufficient: true,
      },
    ],
    items: [
      {
        id: `item-${id}-1`,
        menu_id: "menu-1",
        menu_title: "Nasi Goreng",
        quantity: 10,
        is_finished: isAccepted,
        stock_estimation: lineStockEstimation,
      },
      {
        id: `item-${id}-2`,
        menu_id: "menu-2",
        menu_title: "Mie Goreng",
        quantity: 5,
        is_finished: false,
        stock_estimation: lineStockEstimation,
      },
    ],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

function buildSummary(request) {
  return {
    id: request.id,
    status: request.status,
    is_fully_producible: request.is_fully_producible,
    item_count: request.items.length,
    created_by_username: request.created_by_username,
    created_at: request.created_at,
    updated_at: request.updated_at,
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
              id: ADMIN_USER_ID,
              email: ADMIN_EMAIL,
              name: "Admin User",
              roles: ["admin"],
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

    if (
      pathname.includes(`/api/v1/users/${ADMIN_USER_ID}`) &&
      method === "GET"
    ) {
      return route.fulfill(
        json({
          success: true,
          data: {
            id: ADMIN_USER_ID,
            email: ADMIN_EMAIL,
            name: "Admin User",
            roles: ["admin"],
            merchant_id: "merchant-1",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        }),
      );
    }

    if (pathname.startsWith("/api/admin/production-requests")) {
      if (method === "GET" && pathname === "/api/admin/production-requests") {
        const visible = state.requests.filter((r) => !state.deletedIds.has(r.id));
        return route.fulfill(
          json({
            success: true,
            data: visible.map(buildSummary),
            meta: { page: 1, per_page: 10, total: visible.length },
          }),
        );
      }

      const detailMatch = pathname.match(
        /^\/api\/admin\/production-requests\/([^/]+)$/,
      );
      if (detailMatch && method === "GET") {
        const id = detailMatch[1];
        if (state.deletedIds.has(id)) {
          return route.fulfill(json({ success: false, message: "Not found" }, 404));
        }
        const found = state.requests.find((r) => r.id === id);
        if (!found) {
          return route.fulfill(json({ success: false, message: "Not found" }, 404));
        }
        return route.fulfill(json({ success: true, data: found }));
      }

      if (detailMatch && method === "DELETE") {
        const id = detailMatch[1];
        state.deletedIds.add(id);
        state.deleteCalls.push(id);
        return route.fulfill({ status: 204, body: "" });
      }
    }

    return route.continue();
  });
}

async function login(page) {
  await page.goto(`${WEB_BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin\/(?!login)/, { timeout: 15000 });
}

async function assertMutationControlsAbsent(page) {
  const forbidden = [
    { type: "text", value: "Edit request" },
    { type: "role", role: "button", name: "Approve to ACCEPTED" },
    { type: "role", role: "button", name: "Save changes" },
    { type: "text", value: "Production progress" },
    { type: "role", role: "button", name: "Ready to pick" },
    { type: "role", role: "checkbox", name: "Mark Nasi Goreng finished" },
    { type: "role", role: "checkbox", name: "Mark Mie Goreng finished" },
    { type: "label", name: "Notes (optional)" },
  ];

  for (const entry of forbidden) {
    let locator;
    if (entry.type === "text") {
      locator = page.getByText(entry.value, { exact: true });
    } else if (entry.type === "role") {
      locator = page.getByRole(entry.role, { name: entry.name });
    } else if (entry.type === "label") {
      locator = page.getByLabel(entry.name);
    }
    if (await locator.count()) {
      throw new Error(`Mutation control should be absent: ${entry.name ?? entry.value}`);
    }
  }
}

async function openRequestedDetailFromList(page) {
  await page.goto(`${WEB_BASE}/admin/production-requests`, {
    waitUntil: "networkidle",
  });
  const rows = page.locator("table tbody tr");
  await rows.first().waitFor({ timeout: 15000 });
  const rowCount = await rows.count();
  if (rowCount < 1) {
    throw new Error("Production requests list has no rows");
  }
  const requestedRow = rows.filter({ hasText: "REQUESTED" }).first();
  if (await requestedRow.count()) {
    await requestedRow.click();
  } else {
    await rows.first().click();
  }
  await page.waitForURL(/\/admin\/production-requests\/[^/]+$/, {
    timeout: 15000,
  });
  await page.getByRole("heading", { name: "Production request" }).waitFor({
    timeout: 15000,
  });
}

async function runMockedFlow(page, state) {
  await installApiMocks(page, state);
  await login(page);

  // 1. Mocked admin navigates list to detail
  await openRequestedDetailFromList(page);
  console.log("PASS: Mocked admin navigates list to detail");

  // 2. Mocked admin-only REQUESTED detail is read-only
  if (await page.getByText("Edit request").count()) {
    throw new Error("Edit request should not be visible for admin-only REQUESTED");
  }
  if (await page.getByRole("button", { name: "Approve to ACCEPTED" }).count()) {
    throw new Error("Approve control should not be visible for admin-only REQUESTED");
  }
  if (await page.getByRole("button", { name: "Save changes" }).count()) {
    throw new Error("Save changes should not be visible for admin-only REQUESTED");
  }
  if (!(await page.getByText("Rush order for POS-60-3 verification").isVisible())) {
    throw new Error("Notes section should remain visible when notes are present");
  }
  console.log("PASS: Mocked admin-only REQUESTED detail is read-only");

  // 6. Mocked mutation controls absent on detail (REQUESTED)
  await assertMutationControlsAbsent(page);
  console.log("PASS: Mocked mutation controls absent on REQUESTED detail");

  // ACCEPTED fixture read-only assertions
  await page.goto(`${WEB_BASE}/admin/production-requests/${ACCEPTED_ID}`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("heading", { name: "Production request" }).waitFor({
    timeout: 15000,
  });
  if (await page.getByText("Production progress").count()) {
    throw new Error("Production progress should be hidden for admin-only ACCEPTED");
  }
  if (await page.getByRole("button", { name: "Ready to pick" }).count()) {
    throw new Error("Ready to pick should be hidden for admin-only ACCEPTED");
  }
  if (await page.getByRole("checkbox", { name: "Mark Nasi Goreng finished" }).count()) {
    throw new Error("Mark finished checkbox should be hidden for admin-only ACCEPTED");
  }
  if (!(await page.getByText("Finished", { exact: true }).isVisible())) {
    throw new Error("Finished badge should be visible for completed ACCEPTED items");
  }
  await assertMutationControlsAbsent(page);
  console.log("PASS: Mocked admin-only ACCEPTED detail is read-only");

  // Return to REQUESTED detail for delete flow
  await page.goto(`${WEB_BASE}/admin/production-requests/${REQUESTED_ID}`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("heading", { name: "Production request" }).waitFor({
    timeout: 15000,
  });

  // 3. Mocked admin-only delete button visible
  const deleteButton = page.getByRole("button", {
    name: "Delete production request",
  });
  if (!(await deleteButton.isVisible())) {
    throw new Error("Delete production request button not visible in danger zone");
  }
  console.log("PASS: Mocked admin-only delete button visible");

  // 4. Mocked delete dialog opens
  await deleteButton.click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ timeout: 10000 });
  const dialogText = await dialog.innerText();
  if (!/cannot be undone/i.test(dialogText)) {
    throw new Error("Delete dialog missing cannot-be-undone messaging");
  }
  console.log("PASS: Mocked delete dialog opens");

  // 5. Mocked delete confirms and redirects
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await page.waitForURL(/\/admin\/production-requests$/, { timeout: 15000 });
  await page.getByText("Production request deleted").waitFor({ timeout: 10000 });
  if (!state.deleteCalls.includes(REQUESTED_ID)) {
    throw new Error("DELETE API was not called for production request");
  }
  console.log("PASS: Mocked delete confirms and redirects");
}

async function runLiveFlow(page) {
  await login(page);

  await page.goto(`${WEB_BASE}/admin/production-requests`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector("table tbody tr", { timeout: 15000 });
  const rowCount = await page.locator("table tbody tr").count();
  if (rowCount < 1) {
    throw new Error("Live stack: production requests list has no rows");
  }

  await page.locator("table tbody tr").first().click();
  await page.waitForURL(/\/admin\/production-requests\/[^/]+$/, {
    timeout: 15000,
  });
  await page.getByRole("heading", { name: "Production request" }).waitFor({
    timeout: 15000,
  });

  const deleteButton = page.getByRole("button", {
    name: "Delete production request",
  });
  if (!(await deleteButton.isVisible())) {
    throw new Error("Live stack: delete button not visible for admin-only user");
  }

  await assertMutationControlsAbsent(page);
  console.log("PASS: Live local stack browser verification");
}

async function main() {
  const state = {
    requests: [
      buildProductionRequest(REQUESTED_ID, { status: "REQUESTED" }),
      buildProductionRequest(ACCEPTED_ID, { status: "ACCEPTED" }),
    ],
    deletedIds: new Set(),
    deleteCalls: [],
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  if (MOCK_API) {
    console.log(`Running mocked browser verification (API_BASE=${API_BASE})`);
    await runMockedFlow(page, state);
  } else {
    console.log(
      `Running live browser verification (WEB_BASE=${WEB_BASE}, API_BASE=${API_BASE})`,
    );
    await runLiveFlow(page);
  }

  await browser.close();
  console.log("All POS-60-3 browser checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
