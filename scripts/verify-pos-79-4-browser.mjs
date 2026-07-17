#!/usr/bin/env node
/**
 * Browser verification for POS-79-4: expenses list page and navigation.
 *
 * Mocked mode (default) exercises list UI without luna_pos_service.
 * Set MOCK_API=0 to hit a live API.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const MANAGER_EMAIL =
  process.env.TEST_MANAGER_EMAIL ?? "manager-test@cymonevo.com";
const OPERATIONAL_EMAIL =
  process.env.TEST_OPERATIONAL_EMAIL ?? "operation-test@cymonevo.com";
const CASHIER_EMAIL =
  process.env.TEST_CASHIER_EMAIL ?? "cashier-test@cymonevo.com";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "LunaTesting123!";
const MOCK_API = !["0", "false", "no"].includes(
  String(process.env.MOCK_API ?? "1").toLowerCase(),
);

const MANAGER_USER_ID = "user-manager-verify-79-4";
const OPERATIONAL_USER_ID = "user-operational-verify-79-4";
const CASHIER_USER_ID = "user-cashier-verify-79-4";

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

const allExpenses = [
  {
    id: "exp-verify-79-4-a",
    title: "Office Supplies Alpha",
    description: "Pens and paper",
    amount: 125000,
    receipt_url: "https://example.com/receipt-a.jpg",
    created_by_user_id: MANAGER_USER_ID,
    created_by_username: "Manager User",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "exp-verify-79-4-b",
    title: "Travel Beta",
    description: "Taxi fare",
    amount: 85000,
    receipt_url: null,
    created_by_user_id: MANAGER_USER_ID,
    created_by_username: "Manager User",
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
  {
    id: "exp-verify-79-4-c",
    title: "Office Supplies Gamma",
    description: "Printer ink",
    amount: 200000,
    receipt_url: null,
    created_by_user_id: MANAGER_USER_ID,
    created_by_username: "Manager User",
    created_at: "2026-01-03T00:00:00Z",
    updated_at: "2026-01-03T00:00:00Z",
  },
];

let deletedExpenseIds = new Set();

async function installApiMocks(page) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;

    if (pathname.endsWith("/api/v1/auth/login") && method === "POST") {
      const body = request.postDataJSON();
      const email = body?.email ?? MANAGER_EMAIL;
      const roles =
        email === OPERATIONAL_EMAIL
          ? ["operational"]
          : email === CASHIER_EMAIL
            ? ["cashier"]
            : ["manager"];
      const userId =
        email === OPERATIONAL_EMAIL
          ? OPERATIONAL_USER_ID
          : email === CASHIER_EMAIL
            ? CASHIER_USER_ID
            : MANAGER_USER_ID;

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
              refresh_token: makeJwt({ uid: userId, email, roles, typ: "refresh" }),
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
        userId === OPERATIONAL_USER_ID
          ? ["operational"]
          : userId === CASHIER_USER_ID
            ? ["cashier"]
            : ["manager"];
      const email =
        userId === OPERATIONAL_USER_ID
          ? OPERATIONAL_EMAIL
          : userId === CASHIER_USER_ID
            ? CASHIER_EMAIL
            : MANAGER_EMAIL;

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

    if (pathname === "/api/admin/expenses" && method === "GET") {
      const search = url.searchParams.get("search")?.toLowerCase() ?? "";
      const page = Number(url.searchParams.get("page") ?? "1");
      const perPage = Number(url.searchParams.get("per_page") ?? "10");
      const filtered = allExpenses.filter((expense) => {
        if (deletedExpenseIds.has(expense.id)) return false;
        if (!search) return true;
        return expense.title.toLowerCase().includes(search);
      });
      const start = (page - 1) * perPage;
      const slice = filtered.slice(start, start + perPage);

      return route.fulfill(
        json({
          success: true,
          data: slice,
          meta: { page, per_page: perPage, total: filtered.length },
        }),
      );
    }

    const deleteMatch = pathname.match(/^\/api\/admin\/expenses\/([^/]+)$/);
    if (deleteMatch && method === "DELETE") {
      deletedExpenseIds.add(deleteMatch[1]);
      return route.fulfill(json({ success: true, data: null }));
    }

    return route.continue();
  });
}

async function seedSession(context, page, role) {
  const userId =
    role === "operational"
      ? OPERATIONAL_USER_ID
      : role === "cashier"
        ? CASHIER_USER_ID
        : MANAGER_USER_ID;
  const email =
    role === "operational"
      ? OPERATIONAL_EMAIL
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

async function expectManagerNavAndList(page) {
  await page.goto(`${WEB_BASE}/admin/expenses`, { waitUntil: "networkidle" });
  await page.getByTestId("expenses-page").waitFor({ timeout: 15000 });
  await page.getByRole("link", { name: "Expenses", exact: true }).waitFor();
  await page.getByRole("columnheader", { name: "Title" }).waitFor();
  await page.getByRole("columnheader", { name: "Amount" }).waitFor();
  await page.getByTestId("expense-row-exp-verify-79-4-a").waitFor();
  console.log("PASS: Manager sees expenses navigation and list page");
}

async function expectOperationalAccess(page, context) {
  await seedSession(context, page, "operational");
  await page.goto(`${WEB_BASE}/admin/expenses`, { waitUntil: "networkidle" });
  await page.getByTestId("expenses-page").waitFor({ timeout: 15000 });
  await page.getByTestId("expense-row-exp-verify-79-4-a").waitFor();
  console.log("PASS: Operational user can access expenses list");
}

async function expectCashierBlocked(page, context) {
  await seedSession(context, page, "cashier");
  await page.goto(`${WEB_BASE}/admin/expenses`, { waitUntil: "networkidle" });
  await page.waitForURL((url) => !url.pathname.startsWith("/admin/expenses"), {
    timeout: 15000,
  });
  const pathname = new URL(page.url()).pathname;
  if (pathname.startsWith("/admin/expenses")) {
    throw new Error(`Cashier should not remain on expenses page, got ${pathname}`);
  }
  console.log(`PASS: Cashier cannot access expenses page (redirected to ${pathname})`);
}

async function expectSearchFilters(page, context) {
  deletedExpenseIds = new Set();
  await seedSession(context, page, "manager");
  await page.goto(`${WEB_BASE}/admin/expenses`, { waitUntil: "networkidle" });
  await page.getByTestId("expense-row-exp-verify-79-4-a").waitFor();
  await page.getByTestId("expense-row-exp-verify-79-4-b").waitFor();

  const searchResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/expenses") &&
      res.request().method() === "GET" &&
      res.url().includes("search=Alpha"),
  );
  await page.getByTestId("expenses-search-input").fill("Alpha");
  await searchResponse;

  await page.getByTestId("expense-row-exp-verify-79-4-a").waitFor();
  await page.getByTestId("expense-row-exp-verify-79-4-b").waitFor({ state: "hidden" });
  console.log("PASS: Search filters expense list");
}

async function expectDeleteExpense(page, context) {
  deletedExpenseIds = new Set();
  await seedSession(context, page, "manager");
  await page.goto(`${WEB_BASE}/admin/expenses`, { waitUntil: "networkidle" });
  await page.getByTestId("expense-row-exp-verify-79-4-b").waitFor();

  const deleteResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/expenses/exp-verify-79-4-b") &&
      res.request().method() === "DELETE" &&
      res.status() === 200,
  );

  await page.getByTestId("expense-delete-exp-verify-79-4-b").click();
  await page.getByTestId("expense-delete-dialog").waitFor();
  await page.getByTestId("expense-delete-confirm").click();
  await deleteResponse;

  await page.getByTestId("expense-row-exp-verify-79-4-b").waitFor({ state: "hidden" });
  console.log("PASS: Delete expense from list");
}

async function expectReceiptLink(page, context) {
  deletedExpenseIds = new Set();
  await seedSession(context, page, "manager");
  await page.goto(`${WEB_BASE}/admin/expenses`, { waitUntil: "networkidle" });
  const receiptLink = page
    .getByTestId("expense-row-exp-verify-79-4-a")
    .getByTestId("expense-receipt-link");
  await receiptLink.waitFor();
  const href = await receiptLink.getAttribute("href");
  if (!href?.includes("receipt-a.jpg")) {
    throw new Error(`Expected receipt href, got ${href}`);
  }
  const target = await receiptLink.getAttribute("target");
  if (target !== "_blank") {
    throw new Error(`Expected target=_blank, got ${target}`);
  }
  console.log("PASS: Receipt link visible when present");
}

async function main() {
  console.log(
    `POS-79-4 browser verification (MOCK_API=${MOCK_API}, WEB_BASE=${WEB_BASE})`,
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  if (MOCK_API) {
    await installApiMocks(page);
    await seedSession(context, page, "manager");
    await expectManagerNavAndList(page);
    await expectOperationalAccess(page, context);
    await expectCashierBlocked(page, context);
    await expectSearchFilters(page, context);
    await expectDeleteExpense(page, context);
    await expectReceiptLink(page, context);
  } else {
  await seedSession(context, page, "manager");
  await page.goto(`${WEB_BASE}/admin/expenses`, { waitUntil: "networkidle" });
  await page.getByTestId("expenses-page").waitFor({ timeout: 15000 });
  console.log("PASS: Manager sees expenses list page (live API)");
  }

  await browser.close();
  console.log("All POS-79-4 browser checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
