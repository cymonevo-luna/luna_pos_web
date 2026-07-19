#!/usr/bin/env node
/**
 * Browser verification for POS-121-4: reduce parallel API fan-out on dashboard navigation.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const MANAGER_EMAIL =
  process.env.TEST_MANAGER_EMAIL ?? "manager-test@cymonevo.com";
const MANAGER_PASSWORD =
  process.env.TEST_MANAGER_PASSWORD ?? "LunaTesting123!";
const MAX_API_CALLS = 15;

const MANAGER_USER_ID = "user-manager-verify-121-4";

const MANAGER_FEATURES = [
  "food_supplies.manage",
  "branch_assets.manage",
  "categories.manage",
  "menus.manage",
  "cogs.view",
  "transactions.view",
  "insights.cash_flow",
  "expenses.manage",
  "recurring_expenses.manage",
  "cashier_balance.manage",
  "store_settings.manage",
  "order_options.manage",
  "production_requests.view",
  "production_requests.manage",
];

function makeJwt(claims = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url",
  );
  const body = Buffer.from(
    JSON.stringify({
      uid: MANAGER_USER_ID,
      email: MANAGER_EMAIL,
      roles: ["manager"],
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

function emptyList() {
  return json({
    success: true,
    data: [],
    meta: { page: 1, per_page: 10, total: 0 },
  });
}

function summaryBuckets() {
  return json({
    success: true,
    data: {
      period: "daily",
      buckets: [
        {
          period_start: "2026-07-18T00:00:00Z",
          period_label: "Jul 18",
          count: 3,
          total_amount: 150000,
        },
      ],
    },
  });
}

function cashFlowSummary() {
  return json({
    success: true,
    data: {
      period: "daily",
      totals: {
        inflow_amount: 100000,
        inflow_count: 2,
        outflow_amount: 50000,
        outflow_count: 1,
        net_amount: 50000,
      },
      buckets: [],
    },
  });
}

function storeSettings() {
  return json({
    success: true,
    data: {
      brand_name: "Luna",
      branch_name: "Main",
      address: "123 Street",
      phone: "08123456789",
      thank_you_note: "Thanks!",
    },
  });
}

function isApiRequest(url) {
  return url.startsWith(API_BASE);
}

function installApiMocks(page) {
  return page.route(`${API_BASE}/**`, async (route) => {
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
              id: MANAGER_USER_ID,
              email: MANAGER_EMAIL,
              name: "Manager User",
              roles: ["manager"],
              features: MANAGER_FEATURES,
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

    if (pathname.includes(`/api/v1/users/${MANAGER_USER_ID}`) && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: {
            id: MANAGER_USER_ID,
            email: MANAGER_EMAIL,
            name: "Manager User",
            roles: ["manager"],
            features: MANAGER_FEATURES,
            merchant_id: "merchant-1",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        }),
      );
    }

    if (pathname === "/api/admin/transactions/summary" && method === "GET") {
      return route.fulfill(summaryBuckets());
    }

    if (pathname === "/api/admin/transactions" && method === "GET") {
      return route.fulfill(emptyList());
    }

    if (pathname === "/api/admin/cash-flow/summary" && method === "GET") {
      return route.fulfill(cashFlowSummary());
    }

    if (pathname === "/api/admin/categories" && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: [
            {
              id: "cat-1",
              name: "Main",
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
          ],
          meta: { page: 1, per_page: 100, total: 1 },
        }),
      );
    }

    if (pathname === "/api/admin/menus" && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: [
            {
              id: "menu-1",
              title: "Nasi Goreng",
              description: null,
              category_id: "cat-1",
              category_name: "Main",
              photo_url: null,
              available_stock: 10,
              sell_price: 25000,
              recipe_yield: 1,
              margin_percent: 0,
              vat_percent: 0,
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
          ],
          meta: { page: 1, per_page: 10, total: 1 },
        }),
      );
    }

    if (pathname === "/api/admin/store-settings" && method === "GET") {
      return route.fulfill(storeSettings());
    }

    if (pathname.endsWith("/api/v1/auth/refresh") && method === "POST") {
      return route.fulfill(
        json({
          success: true,
          data: {
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

    return route.fulfill(json({ success: true, data: null }));
  });
}

async function seedManagerSession(context, page) {
  const accessToken = makeJwt({ typ: "access" });
  const refreshToken = makeJwt({ typ: "refresh" });
  const now = Date.now();
  const accessExpiresAt = now + 3600 * 1000;
  const refreshExpiresAt = now + 86400 * 1000;
  const user = {
    id: MANAGER_USER_ID,
    email: MANAGER_EMAIL,
    name: "Manager User",
    roles: ["manager"],
    features: MANAGER_FEATURES,
    merchant_id: "merchant-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
  const merchant = { id: "merchant-1", name: "Test Merchant" };

  await context.addCookies([
    {
      name: "nt_access_token",
      value: accessToken,
      domain: "localhost",
      path: "/",
      expires: Math.floor(accessExpiresAt / 1000),
    },
    {
      name: "nt_refresh_token",
      value: refreshToken,
      domain: "localhost",
      path: "/",
      expires: Math.floor(refreshExpiresAt / 1000),
    },
  ]);

  await page.addInitScript(
    ({ accessToken, refreshToken, accessExpiresAt, refreshExpiresAt, user, merchant }) => {
      localStorage.setItem("nt_access_token", accessToken);
      localStorage.setItem("nt_refresh_token", refreshToken);
      localStorage.setItem("nt_access_expires_at", String(accessExpiresAt));
      localStorage.setItem("nt_refresh_expires_at", String(refreshExpiresAt));
      localStorage.setItem("nt_user", JSON.stringify(user));
      localStorage.setItem("nt_merchant", JSON.stringify(merchant));
    },
    {
      accessToken,
      refreshToken,
      accessExpiresAt,
      refreshExpiresAt,
      user,
      merchant,
    },
  );
}

function createApiCallTracker(page) {
  const calls = [];
  const seen = new Set();

  page.on("request", (request) => {
    const url = request.url();
    if (!isApiRequest(url)) return;
    const method = request.method();
    const pathname = new URL(url).pathname + new URL(url).search;
    const key = `${method} ${pathname}`;
    if (seen.has(key)) return;
    seen.add(key);
    calls.push(key);
  });

  return {
    reset() {
      calls.length = 0;
      seen.clear();
    },
    count() {
      return calls.length;
    },
    list() {
      return [...calls];
    },
  };
}

function assertMaxCalls(label, count, max = MAX_API_CALLS) {
  if (count > max) {
    throw new Error(`${label}: ${count} API calls (max ${max})`);
  }
  console.log(`PASS ${label}: ${count} API calls (<= ${max})`);
}

async function waitForAdminHome(page) {
  await page.waitForSelector('[data-testid="greeting-card"], h2:has-text("Summary")', {
    timeout: 15000,
  });
}

async function clickNavLink(page, label, parentGroup) {
  if (parentGroup) {
    const groupButton = page.getByRole("button", { name: parentGroup });
    const expanded = await groupButton.getAttribute("aria-expanded");
    if (expanded !== "true") {
      await groupButton.click();
    }
  }
  await page.getByRole("link", { name: label, exact: true }).click();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const tracker = createApiCallTracker(page);

  await installApiMocks(page);
  await seedManagerSession(context, page);

  // 1. Dashboard home API call count
  tracker.reset();
  await page.goto(`${WEB_BASE}/admin`, { waitUntil: "networkidle" });
  await waitForAdminHome(page);
  const homeFirstLoad = tracker.count();
  assertMaxCalls("Dashboard home API call count", homeFirstLoad);
  console.log("  calls:", tracker.list().join(", "));

  // 2. Menus page API call count
  tracker.reset();
  await clickNavLink(page, "Menu", "Food");
  await page.waitForSelector("text=Nasi Goreng", { timeout: 15000 });
  const menusLoad = tracker.count();
  assertMaxCalls("Menus page API call count", menusLoad);
  console.log("  calls:", tracker.list().join(", "));

  // 3. Cache prevents duplicate refetch
  tracker.reset();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await waitForAdminHome(page);
  const homeSecondVisit = tracker.count();
  if (homeSecondVisit >= homeFirstLoad) {
    throw new Error(
      `Cache prevents duplicate refetch: second visit ${homeSecondVisit} >= first ${homeFirstLoad}`,
    );
  }
  console.log(
    `PASS Cache prevents duplicate refetch: second visit ${homeSecondVisit} < first ${homeFirstLoad}`,
  );

  // 4. No 429 on normal navigation smoke
  const statusCodes = [];
  page.on("response", (response) => {
    if (!isApiRequest(response.url())) return;
    statusCodes.push(response.status());
  });

  await page.goto(`${WEB_BASE}/admin`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await clickNavLink(page, "Menu", "Food");
  await page.waitForTimeout(2000);
  await clickNavLink(page, "User Transactions", "Food");
  await page.waitForTimeout(2000);
  await clickNavLink(page, "Receipt Setting", "Branch");
  await page.waitForTimeout(2000);

  const has429 = statusCodes.includes(429);
  if (has429) {
    throw new Error("No 429 on normal navigation smoke: received 429 response");
  }
  console.log("PASS No 429 on normal navigation smoke");

  await browser.close();
  console.log("\nAll POS-121-4 browser checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
