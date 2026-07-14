#!/usr/bin/env node
/**
 * Browser verification for POS-60-3 / POS-62-2 / POS-63-2 / POS-70-1: admin-only
 * production request detail is read-only with delete available.
 *
 * Live mode requires Next.js started with NEXT_PUBLIC_API_URL matching API_BASE
 * (e.g. NEXT_PUBLIC_API_URL=http://localhost:8087 npm run dev).
 *
 * Environment contract:
 * | Variable | Default | Purpose |
 * |---|---|---|
 * | WEB_BASE | http://localhost:3000 | Next.js app URL |
 * | NEXT_PUBLIC_API_URL | http://localhost:8087 | API base (API_BASE in script) |
 * | TEST_ADMIN_EMAIL | admin-test@cymonevo.com | Admin login |
 * | TEST_ADMIN_PASSWORD | LunaTesting123! | Admin password |
 * | TEST_MANAGER_EMAIL / TEST_MANAGER_PASSWORD | manager-test defaults | Fixture seeding |
 * | TEST_OPERATIONAL_EMAIL / TEST_OPERATIONAL_PASSWORD | operation-test defaults | ACCEPTED fixture seeding (mocked only) |
 * | MOCK_API | 1 (mocked) | Set 0/false/no for live stack |
 * | LIVE_DELETE | 0 | Set 1/true/yes for full live delete E2E |
 * | LUNA_POS_SERVICE_DIR | ../luna_pos_service | Resolve sibling service seed scripts |
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "admin-test@cymonevo.com";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "LunaTesting123!";
const MANAGER_EMAIL =
  process.env.TEST_MANAGER_EMAIL ?? "manager-test@cymonevo.com";
const MANAGER_PASSWORD =
  process.env.TEST_MANAGER_PASSWORD ?? "LunaTesting123!";
const OPERATIONAL_EMAIL =
  process.env.TEST_OPERATIONAL_EMAIL ?? "operation-test@cymonevo.com";
const OPERATIONAL_PASSWORD =
  process.env.TEST_OPERATIONAL_PASSWORD ?? "LunaTesting123!";
const MOCK_API = !["0", "false", "no"].includes(
  String(process.env.MOCK_API ?? "1").toLowerCase(),
);
const LIVE_DELETE = ["1", "true", "yes"].includes(
  String(process.env.LIVE_DELETE ?? "0").toLowerCase(),
);

const SEED_NOTES = "Rush order for POS-60-3 verification";
const SEED_ACCEPTED_NOTES =
  "POS-60-3 ACCEPTED fixture (seeded — do not delete in browser QA)";

const REQUESTED_ID = "prod-verify-60-3-requested";
const ACCEPTED_ID = "prod-verify-60-3-accepted";
const ADMIN_USER_ID = "user-admin-verify-60-3";

const API_UNREACHABLE_HINT =
  "start luna_pos_service (make docker-up-d) and re-run";

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
    notes: SEED_NOTES,
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

async function assertApiReachable() {
  try {
    const res = await fetch(`${API_BASE}/healthz`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch {
    throw new Error(
      `Live stack unavailable at ${API_BASE} — ${API_UNREACHABLE_HINT}`,
    );
  }
}

async function apiLogin(email, password) {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: HTTP ${res.status}`);
  }
  const body = await res.json();
  const token = body?.data?.tokens?.access_token;
  if (!token) {
    throw new Error(`Login response missing access_token for ${email}`);
  }
  return token;
}

async function apiJson(path, token, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const message =
      typeof body === "object" && body?.message
        ? body.message
        : `HTTP ${res.status}`;
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${message}`);
  }
  return body;
}

async function ensureMenus(token) {
  const list = await apiJson("/api/admin/menus?page=1&per_page=10", token);
  const menus = list?.data ?? [];
  if (menus.length > 0) {
    return menus;
  }

  const category = await apiJson("/api/admin/categories", token, {
    method: "POST",
    body: JSON.stringify({ name: "POS-60-3 QA" }),
  });
  const categoryId = category.data.id;

  const menu = await apiJson("/api/admin/menus", token, {
    method: "POST",
    body: JSON.stringify({
      title: "POS-60-3 QA Menu",
      category_id: categoryId,
      available_stock: 100,
      sell_price: 15000,
    }),
  });

  return [menu.data];
}

async function createProductionRequest(token, items, notes) {
  const created = await apiJson("/api/admin/production-requests", token, {
    method: "POST",
    body: JSON.stringify({ items, notes }),
  });
  return created.data;
}

async function inlineSeedLiveFixtures() {
  const managerToken = await apiLogin(MANAGER_EMAIL, MANAGER_PASSWORD);
  const operationalToken = await apiLogin(
    OPERATIONAL_EMAIL,
    OPERATIONAL_PASSWORD,
  );
  const menus = await ensureMenus(managerToken);
  const menuA = menus[0];
  const menuB = menus[1] ?? menus[0];

  const list = await apiJson(
    "/api/admin/production-requests?page=1&per_page=50",
    managerToken,
  );
  const rows = list?.data ?? [];

  let requestedId = rows.find(
    (row) => row.status === "REQUESTED" && row.id,
  )?.id;
  let acceptedId = rows.find((row) => row.status === "ACCEPTED")?.id;

  if (!requestedId) {
    const created = await createProductionRequest(
      managerToken,
      [{ menu_id: menuA.id, quantity: 2 }],
      SEED_NOTES,
    );
    requestedId = created.id;
  }

  if (!acceptedId) {
    const created = await createProductionRequest(
      managerToken,
      [
        { menu_id: menuA.id, quantity: 10 },
        { menu_id: menuB.id, quantity: 5 },
      ],
      SEED_ACCEPTED_NOTES,
    );
    const acceptedRequestId = created.id;

    await apiJson(
      `/api/admin/production-requests/${acceptedRequestId}/status`,
      operationalToken,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "ACCEPTED" }),
      },
    );

    const detail = await apiJson(
      `/api/admin/production-requests/${acceptedRequestId}`,
      operationalToken,
    );
    const firstItem = detail?.data?.items?.[0];
    if (firstItem?.id) {
      await apiJson(
        `/api/admin/production-requests/${acceptedRequestId}/items/${firstItem.id}`,
        operationalToken,
        {
          method: "PATCH",
          body: JSON.stringify({ is_finished: true }),
        },
      );
    }

    acceptedId = acceptedRequestId;
  }

  return { requestedId, acceptedId };
}

function resolveServiceDirs() {
  const repoRoot = join(__dirname, "..");
  const dirs = [];
  if (process.env.LUNA_POS_SERVICE_DIR) {
    dirs.push(process.env.LUNA_POS_SERVICE_DIR);
  }
  dirs.push(
    join(repoRoot, "..", "luna_pos_service"),
    join(repoRoot, "luna_pos_service"),
  );
  return [...new Set(dirs.map((dir) => dir.replace(/\/$/, "")))];
}

function resolveSeedScript() {
  const dirs = resolveServiceDirs();
  for (const dir of dirs) {
    const deleteScript = join(
      dir,
      "scripts/seed-production-request-delete-qa.sh",
    );
    if (existsSync(deleteScript)) {
      return deleteScript;
    }
  }
  for (const dir of dirs) {
    const browserScript = join(
      dir,
      "scripts/seed-production-request-browser-qa.sh",
    );
    if (existsSync(browserScript)) {
      return browserScript;
    }
  }
  return null;
}

async function listProductionRequests(token) {
  const list = await apiJson(
    "/api/admin/production-requests?page=1&per_page=50",
    token,
  );
  return list?.data ?? [];
}

async function bootstrapLiveFixtures() {
  const managerToken = await apiLogin(MANAGER_EMAIL, MANAGER_PASSWORD);
  let rows = await listProductionRequests(managerToken);
  if (rows.some((row) => row.status === "REQUESTED")) {
    return;
  }

  const seedScript = resolveSeedScript();
  if (seedScript) {
    try {
      execFileSync("bash", [seedScript, API_BASE], { stdio: "pipe" });
    } catch {
      // Partial fixtures or idempotent seed conflicts — fall back to inline seeding.
    }
    rows = await listProductionRequests(managerToken);
    if (rows.some((row) => row.status === "REQUESTED")) {
      return;
    }
  }

  await inlineSeedLiveFixtures();
  rows = await listProductionRequests(managerToken);
  if (!rows.some((row) => row.status === "REQUESTED")) {
    throw new Error(
      `No REQUESTED production request found after seeding. Live stack unavailable at ${API_BASE} — ${API_UNREACHABLE_HINT}`,
    );
  }
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
  try {
    await page.waitForURL(/\/admin\/(?!login)/, { timeout: 15000 });
  } catch (error) {
    if (!MOCK_API) {
      throw new Error(
        `Admin login did not redirect off /admin/login within 15s (API_BASE=${API_BASE}, TEST_ADMIN_EMAIL=${ADMIN_EMAIL}). ` +
          `Ensure luna_pos_service is healthy and NEXT_PUBLIC_API_URL matches the running API.`,
        { cause: error },
      );
    }
    throw error;
  }
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

async function assertAcceptedDetailReadOnly(page) {
  if (await page.getByText("Production progress").count()) {
    throw new Error("Production progress should be hidden for admin-only ACCEPTED");
  }
  if (await page.getByRole("button", { name: "Ready to pick" }).count()) {
    throw new Error("Ready to pick should be hidden for admin-only ACCEPTED");
  }
  if (await page.getByRole("checkbox", { name: /Mark .+ finished/ }).count()) {
    throw new Error("Mark finished checkbox should be hidden for admin-only ACCEPTED");
  }
  if (!(await page.getByText("Finished", { exact: true }).isVisible())) {
    throw new Error("Finished badge should be visible for completed ACCEPTED items");
  }
  const deleteButton = page.getByRole("button", {
    name: "Delete production request",
  });
  if (!(await deleteButton.isVisible())) {
    throw new Error("Delete production request button not visible on ACCEPTED detail");
  }
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
  if (!(await page.getByText(SEED_NOTES).isVisible())) {
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
  await assertAcceptedDetailReadOnly(page);
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

function extractDetailIdFromUrl(page) {
  const match = page.url().match(/\/admin\/production-requests\/([^/?#]+)/);
  return match?.[1] ?? null;
}

async function assertRowAbsentFromList(page, detailId) {
  if (!/\/admin\/production-requests$/.test(new URL(page.url()).pathname)) {
    await page.goto(`${WEB_BASE}/admin/production-requests`, {
      waitUntil: "networkidle",
    });
  }

  const absent = await page.evaluate(
    async ({ apiBase, id }) => {
      const token = localStorage.getItem("nt_access_token");
      if (!token) {
        throw new Error("Missing access token in localStorage");
      }
      const response = await fetch(
        `${apiBase}/api/admin/production-requests?page=1&per_page=50`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const body = await response.json();
      const ids = (body?.data ?? []).map((row) => row.id);
      return !ids.includes(id);
    },
    { apiBase: API_BASE, id: detailId },
  );

  if (!absent) {
    throw new Error(`Deleted production request ${detailId} still visible in list`);
  }
}

async function runLiveDeleteFlow(page, deleteButton) {
  await deleteButton.click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ timeout: 10000 });
  const dialogText = await dialog.innerText();
  if (!/cannot be undone/i.test(dialogText)) {
    throw new Error("Delete dialog missing cannot-be-undone messaging");
  }

  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await page.waitForURL(/\/admin\/production-requests$/, { timeout: 15000 });
  await page.getByText("Production request deleted").waitFor({ timeout: 10000 });
}

async function runLiveFlow(page) {
  // 1. Admin login
  await login(page);
  if (page.url().includes("/admin/login")) {
    throw new Error("Admin login did not redirect off /admin/login");
  }
  console.log("PASS: Live admin login succeeds");

  // 2. Navigate list to REQUESTED detail (same row filter as openRequestedDetailFromList)
  await openRequestedDetailFromList(page);
  console.log("PASS: Live admin navigates list to detail");

  const detailId = extractDetailIdFromUrl(page);
  if (!detailId) {
    throw new Error("Could not determine production request id from detail URL");
  }

  // 3. REQUESTED detail read-only for admin
  await assertMutationControlsAbsent(page);
  const deleteButton = page.getByRole("button", {
    name: "Delete production request",
  });
  if (!(await deleteButton.isVisible())) {
    throw new Error("Delete production request button not visible on REQUESTED detail");
  }
  console.log("PASS: Live REQUESTED detail is read-only for admin");

  if (!LIVE_DELETE) {
    return;
  }

  // 4. Full delete flow on seeded REQUESTED row
  await runLiveDeleteFlow(page, deleteButton);
  await assertRowAbsentFromList(page, detailId);
  console.log("PASS: Live delete confirms and redirects");
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

  if (MOCK_API) {
    console.log(`Running mocked browser verification (API_BASE=${API_BASE})`);
  } else {
    console.log(
      `Running live browser verification (WEB_BASE=${WEB_BASE}, API_BASE=${API_BASE}, LIVE_DELETE=${LIVE_DELETE})`,
    );
    await assertApiReachable();
    await bootstrapLiveFixtures();
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  if (MOCK_API) {
    await runMockedFlow(page, state);
  } else {
    await runLiveFlow(page);
  }

  await browser.close();
  console.log("All POS-60-3 browser checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
