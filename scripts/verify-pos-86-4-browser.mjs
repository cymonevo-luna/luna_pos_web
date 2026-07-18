#!/usr/bin/env node
/**
 * Browser verification for POS-86-4: admin sidebar nav groups and RBAC filtering.
 *
 * Mocked mode (default) exercises sidebar navigation without luna_pos_service.
 * Set MOCK_API=0 to hit a live API with seeded testing accounts.
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const MANAGER_EMAIL =
  process.env.TEST_MANAGER_EMAIL ?? "manager-test@cymonevo.com";
const OPERATIONAL_EMAIL =
  process.env.TEST_OPERATIONAL_EMAIL ?? "operation-test@cymonevo.com";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "LunaTesting123!";
const MOCK_API = !["0", "false", "no"].includes(
  String(process.env.MOCK_API ?? "1").toLowerCase(),
);

const MANAGER_USER_ID = "user-manager-verify-86-4";
const OPERATIONAL_USER_ID = "user-operational-verify-86-4";

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

function emptyListResponse() {
  return json({
    success: true,
    data: [],
    meta: { page: 1, per_page: 10, total: 0 },
  });
}

async function installApiMocks(page, state) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;

    if (pathname.endsWith("/api/v1/auth/login") && method === "POST") {
      const body = request.postDataJSON();
      const email = body?.email ?? MANAGER_EMAIL;
      const roles =
        email === OPERATIONAL_EMAIL ? ["operational"] : ["manager"];
      const userId =
        email === OPERATIONAL_EMAIL
          ? OPERATIONAL_USER_ID
          : MANAGER_USER_ID;
      state.currentRole = roles[0];

      return route.fulfill(
        json({
          success: true,
          data: {
            user: {
              id: userId,
              email,
              name: "Test User",
              roles,
              merchant_id: "merchant-1",
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
            merchant: { id: "merchant-1", name: "Test Merchant" },
            tokens: {
              access_token: makeJwt({ uid: userId, email, roles, typ: "access" }),
              refresh_token: makeJwt({
                uid: userId,
                email,
                roles,
                typ: "refresh",
              }),
              expires_in: 3600,
              refresh_expires_in: 86400,
            },
          },
        }),
      );
    }

    const userMatch = pathname.match(/\/api\/v1\/users\/([^/]+)$/);
    if (userMatch && method === "GET") {
      const userId = userMatch[1];
      const roles =
        userId === OPERATIONAL_USER_ID ? ["operational"] : ["manager"];
      const email =
        userId === OPERATIONAL_USER_ID ? OPERATIONAL_EMAIL : MANAGER_EMAIL;

      return route.fulfill(
        json({
          success: true,
          data: {
            id: userId,
            email,
            name: "Test User",
            roles,
            merchant_id: "merchant-1",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        }),
      );
    }

    if (
      pathname.startsWith("/api/admin/cogs") ||
      pathname.startsWith("/api/admin/food-supplies") ||
      pathname.startsWith("/api/admin/categories") ||
      pathname.startsWith("/api/admin/insights") ||
      pathname.startsWith("/api/admin/expenses")
    ) {
      if (method === "GET") {
        return route.fulfill(emptyListResponse());
      }
    }

    return route.continue();
  });
}

async function login(page, email, password = TEST_PASSWORD) {
  await page.goto(`${WEB_BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 15000 });
}

async function clearSession(page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

function sidebar(page) {
  return page.locator("aside nav");
}

async function getGroupHeaders(page) {
  const headers = page.locator("aside nav > div > button span.flex-1");
  return headers.allTextContents();
}

async function expandGroup(page, name) {
  const button = page.getByRole("button", { name });
  const expanded = await button.getAttribute("aria-expanded");
  if (expanded !== "true") {
    await button.click();
  }
}

async function expectSidebarLinkVisible(page, name) {
  const link = sidebar(page).getByRole("link", { name, exact: true });
  if ((await link.count()) === 0 || !(await link.first().isVisible())) {
    throw new Error(`Expected sidebar link "${name}" to be visible`);
  }
}

async function expectSidebarLinkHidden(page, name) {
  const link = sidebar(page).getByRole("link", { name, exact: true });
  if ((await link.count()) > 0 && (await link.first().isVisible())) {
    throw new Error(`Expected sidebar link "${name}" to be hidden`);
  }
}

async function expectGroupHidden(page, name) {
  const button = sidebar(page).getByRole("button", { name, exact: true });
  if ((await button.count()) > 0 && (await button.first().isVisible())) {
    throw new Error(`Expected nav group "${name}" to be hidden`);
  }
}

async function expectManagerNavGroups(page) {
  await page.goto(`${WEB_BASE}/admin`, { waitUntil: "networkidle" });
  await sidebar(page).waitFor({ timeout: 15000 });

  const headers = await getGroupHeaders(page);
  const expected = ["Food", "COGS", "Cash Flow"];
  if (headers.length !== expected.length) {
    throw new Error(
      `Expected ${expected.length} nav groups, got ${headers.length}: ${headers.join(", ")}`,
    );
  }
  for (let i = 0; i < expected.length; i += 1) {
    if (headers[i] !== expected[i]) {
      throw new Error(
        `Expected group ${i + 1} to be "${expected[i]}", got "${headers[i]}"`,
      );
    }
  }

  await expectGroupHidden(page, "Supplier");

  await expandGroup(page, "Food");
  for (const child of [
    "Ingredients",
    "Menus",
    "Cook Request",
    "User Transactions",
  ]) {
    await expectSidebarLinkVisible(page, child);
  }

  console.log("PASS: Manager sees three role-filtered nav groups");
}

async function expectOperationalNav(page) {
  await clearSession(page);
  await login(page, OPERATIONAL_EMAIL);
  await page.goto(`${WEB_BASE}/admin`, { waitUntil: "networkidle" });
  await sidebar(page).waitFor({ timeout: 15000 });

  await expandGroup(page, "Food");
  await expectSidebarLinkVisible(page, "Ingredients");
  await expectSidebarLinkVisible(page, "Cook Request");
  await expectSidebarLinkHidden(page, "Menus");
  await expectSidebarLinkHidden(page, "User Transactions");

  await expandGroup(page, "Supplier");
  await expectSidebarLinkVisible(page, "List");
  await expectSidebarLinkVisible(page, "Purchases");

  await expandGroup(page, "Cash Flow");
  await expectSidebarLinkVisible(page, "Expenses");
  await expectSidebarLinkVisible(page, "Recurring Expenses");
  await expectSidebarLinkHidden(page, "BEP");
  await expectSidebarLinkHidden(page, "Summary");

  await expectGroupHidden(page, "COGS");

  console.log("PASS: Operational role filtered nav");
}

async function expectCogsRedirect(page) {
  await clearSession(page);
  await login(page, MANAGER_EMAIL);
  await page.goto(`${WEB_BASE}/admin/cogs`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/admin\/cogs\/menu-breakdown/, { timeout: 15000 });

  const pathname = new URL(page.url()).pathname;
  if (pathname !== "/admin/cogs/menu-breakdown") {
    throw new Error(`Expected /admin/cogs/menu-breakdown, got ${pathname}`);
  }

  await page.getByRole("heading", { name: "COGS" }).waitFor({ timeout: 15000 });
  console.log("PASS: COGS route redirect");
}

async function expectFoodGroupActiveState(page) {
  await clearSession(page);
  await login(page, MANAGER_EMAIL);
  await page.goto(`${WEB_BASE}/admin/food-supplies`, {
    waitUntil: "networkidle",
  });
  await sidebar(page).waitFor({ timeout: 15000 });

  const foodButton = page.getByRole("button", { name: "Food" });
  const foodClass = (await foodButton.getAttribute("class")) ?? "";
  if (
    !foodClass.includes("text-primary") &&
    !foodClass.includes("bg-primary/10")
  ) {
    throw new Error(
      `Food group header missing active styling, class="${foodClass}"`,
    );
  }

  const expanded = await foodButton.getAttribute("aria-expanded");
  if (expanded !== "true") {
    throw new Error(`Expected Food group aria-expanded=true, got ${expanded}`);
  }

  const ingredientsLink = sidebar(page).getByRole("link", {
    name: "Ingredients",
    exact: true,
  });
  const linkClass = (await ingredientsLink.getAttribute("class")) ?? "";
  if (!linkClass.includes("bg-primary")) {
    throw new Error(
      `Ingredients link missing active highlight, class="${linkClass}"`,
    );
  }

  console.log("PASS: Group active state on child route");
}

function runLayoutUnitTests() {
  execFileSync(
    "npm",
    [
      "run",
      "test",
      "--",
      "src/app/admin/(protected)/layout.test.tsx",
      "src/lib/auth/roles.test.ts",
    ],
    { cwd: REPO_ROOT, stdio: "inherit" },
  );
  console.log("PASS: Layout unit tests pass");
}

async function main() {
  console.log(
    `POS-86-4 browser verification (MOCK_API=${MOCK_API}, WEB_BASE=${WEB_BASE})`,
  );

  const state = { currentRole: "manager" };
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  if (MOCK_API) {
    await installApiMocks(page, state);
  }

  await login(page, MANAGER_EMAIL);
  await expectManagerNavGroups(page);
  await expectOperationalNav(page);
  await expectCogsRedirect(page);
  await expectFoodGroupActiveState(page);

  await browser.close();
  runLayoutUnitTests();

  console.log("All POS-86-4 browser checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
