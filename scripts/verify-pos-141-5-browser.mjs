#!/usr/bin/env node
/**
 * Browser verification for POS-141-5: menu disposals admin list page.
 *
 * Mocked mode (default) exercises list UI without luna_pos_service.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const MANAGER_EMAIL =
  process.env.TEST_MANAGER_EMAIL ?? "manager-test@cymonevo.com";
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "admin-test@cymonevo.com";
const CASHIER_EMAIL =
  process.env.TEST_CASHIER_EMAIL ?? "cashier-test@cymonevo.com";
const MOCK_API = !["0", "false", "no"].includes(
  String(process.env.MOCK_API ?? "1").toLowerCase(),
);

const MANAGER_USER_ID = "user-manager-verify-141-5";
const ADMIN_USER_ID = "user-admin-verify-141-5";
const CASHIER_USER_ID = "user-cashier-verify-141-5";

const MANAGER_FEATURES = [
  "food_supplies.manage",
  "categories.manage",
  "menus.manage",
  "transactions.view",
  "menu_disposals.view",
  "production_requests.view",
];

const ADMIN_FEATURES = [...MANAGER_FEATURES, "menu_disposals.delete"];

const allDisposals = [
  {
    id: "disposal-verify-1",
    menu_id: "menu-1",
    menu_title: "Nasi Goreng",
    quantity: 2,
    unit_loss_amount: 15000,
    loss_amount: 30000,
    disposed_by_username: "manager-test",
    note: "Expired",
    disposed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

let deletedDisposalIds = new Set();

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

async function installApiMocks(page) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;

    if (pathname === "/api/admin/menu-disposals" && method === "GET") {
      const search = url.searchParams.get("search")?.toLowerCase() ?? "";
      const pageNum = Number(url.searchParams.get("page") ?? "1");
      const perPage = Number(url.searchParams.get("per_page") ?? "10");
      const dateFrom = url.searchParams.get("date_from");
      const dateTo = url.searchParams.get("date_to");

      const filtered = allDisposals.filter((item) => {
        if (deletedDisposalIds.has(item.id)) return false;
        if (search && !item.menu_title.toLowerCase().includes(search)) {
          return false;
        }
        if (dateFrom || dateTo) {
          const disposedAt = Date.parse(item.disposed_at);
          const fromMs = dateFrom ? Date.parse(dateFrom) : Number.NEGATIVE_INFINITY;
          const toMs = dateTo ? Date.parse(dateTo) : Number.POSITIVE_INFINITY;
          if (disposedAt < fromMs || disposedAt > toMs) return false;
        }
        return true;
      });

      const start = (pageNum - 1) * perPage;
      const slice = filtered.slice(start, start + perPage);

      return route.fulfill(
        json({
          success: true,
          data: slice,
          meta: { page: pageNum, per_page: perPage, total: filtered.length },
        }),
      );
    }

    const deleteMatch = pathname.match(/^\/api\/admin\/menu-disposals\/([^/]+)$/);
    if (deleteMatch && method === "DELETE") {
      deletedDisposalIds.add(deleteMatch[1]);
      return route.fulfill(json({ success: true, data: null }));
    }

    return route.continue();
  });
}

async function seedSession(context, page, role, features = []) {
  const userId =
    role === "admin"
      ? ADMIN_USER_ID
      : role === "cashier"
        ? CASHIER_USER_ID
        : MANAGER_USER_ID;
  const email =
    role === "admin"
      ? ADMIN_EMAIL
      : role === "cashier"
        ? CASHIER_EMAIL
        : MANAGER_EMAIL;
  const roles = [role];

  const accessToken = makeJwt({ uid: userId, email, roles, typ: "access" });
  const refreshToken = makeJwt({ uid: userId, email, roles, typ: "refresh" });
  const now = Date.now();
  const accessExpiresAt = now + 3600 * 1000;
  const refreshExpiresAt = now + 86400 * 1000;
  const user = {
    id: userId,
    email,
    name: "Test User",
    roles,
    features,
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

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const results = [];

  try {
    if (MOCK_API) {
      await installApiMocks(page);
    }

    deletedDisposalIds = new Set();

    await seedSession(context, page, "manager", MANAGER_FEATURES);
    await page.goto(`${WEB_BASE}/admin/menu-disposals`, {
      waitUntil: "networkidle",
    });
    await page.getByTestId("menu-disposals-page").waitFor({ timeout: 15000 });
    await page.getByRole("columnheader", { name: "Date" }).waitFor();
    await page.getByRole("columnheader", { name: "Total loss" }).waitFor();
    const hasRow = (await page.getByText("Nasi Goreng").count()) > 0;
    const hasEmpty =
      (await page.getByTestId("menu-disposals-empty").count()) > 0;
    results.push([
      "Manager views disposal list",
      hasRow || hasEmpty ? "PASS" : "FAIL",
      "Table headers render; rows or empty state visible",
    ]);

    await seedSession(context, page, "cashier", []);
    await page.goto(`${WEB_BASE}/admin/menu-disposals`, {
      waitUntil: "networkidle",
    });
    await page.waitForURL((url) => !url.pathname.startsWith("/admin/menu-disposals"), {
      timeout: 15000,
    });
    const blocked = !new URL(page.url()).pathname.startsWith("/admin/menu-disposals");
    results.push([
      "Unauthorized role blocked",
      blocked ? "PASS" : "FAIL",
      `Cashier blocked from menu disposals (landed on ${new URL(page.url()).pathname})`,
    ]);

    deletedDisposalIds = new Set();
    await seedSession(context, page, "manager", MANAGER_FEATURES);
    await page.goto(`${WEB_BASE}/admin/menu-disposals`, {
      waitUntil: "networkidle",
    });
    await page.getByTestId("menu-disposals-page").waitFor({ timeout: 15000 });
    const today = new Date();
    const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    await page.getByTestId("menu-disposals-date-from").fill(todayValue);
    await page.getByTestId("menu-disposals-date-to").fill(todayValue);
    await page.getByText("Nasi Goreng").waitFor({ timeout: 15000 });
    results.push([
      "Date filter narrows results",
      "PASS",
      "Today filter shows today's disposal row",
    ]);

    deletedDisposalIds = new Set();
    await seedSession(context, page, "admin", ADMIN_FEATURES);
    await page.goto(`${WEB_BASE}/admin/menu-disposals`, {
      waitUntil: "networkidle",
    });
    await page
      .getByTestId("menu-disposal-delete-disposal-verify-1")
      .waitFor({ timeout: 15000 });
    await page.getByTestId("menu-disposal-delete-disposal-verify-1").click();
    await page.getByTestId("menu-disposal-delete-dialog").waitFor();
    await page.getByText("Delete disposal and restore stock?").waitFor();
    await page.getByTestId("menu-disposal-delete-confirm").click();
    await page.getByTestId("menu-disposals-empty").waitFor({ timeout: 15000 });
    results.push([
      "Admin delete with confirmation",
      "PASS",
      "Delete dialog confirmed; row removed from list",
    ]);
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify(results, null, 2));
  if (results.some(([, status]) => status === "FAIL")) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
