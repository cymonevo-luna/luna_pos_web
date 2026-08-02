#!/usr/bin/env node
/**
 * Browser verification for POS-172-5: expense create transaction date picker.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const MANAGER_EMAIL =
  process.env.TEST_MANAGER_EMAIL ?? "manager-test@cymonevo.com";
const WIB_TIMEZONE = "Asia/Jakarta";
const MANAGER_USER_ID = "user-manager-verify-172-5";

/** @type {[string, "PASS" | "FAIL", string][]} */
const results = [];

function record(name, pass, note) {
  results.push([name, pass ? "PASS" : "FAIL", note]);
  console.log(`${pass ? "PASS" : "FAIL"}: ${name}${note ? ` — ${note}` : ""}`);
}

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

function todayWIB() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function startOfDayWIB(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, -7, 0, 0, 0));
}

function daysAgoWib(days) {
  return addDaysWib(todayWIB(), -days);
}

function addDaysWib(dateStr, days) {
  const anchor = startOfDayWIB(dateStr);
  anchor.setTime(anchor.getTime() + days * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(anchor);
}

async function seedSession(context, page, user) {
  const accessToken = makeJwt({ uid: user.id, email: user.email, roles: user.roles });
  const refreshToken = makeJwt({ typ: "refresh", uid: user.id, email: user.email });
  const now = Date.now();
  const accessExpiresAt = now + 3600 * 1000;
  const refreshExpiresAt = now + 86400 * 1000;
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

async function installApiMocks(page, state) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;

    if (pathname.endsWith("/api/v1/auth/login") && method === "POST") {
      return route.fulfill(json({ success: true, data: { user: {}, tokens: {} } }));
    }

    const userMatch = pathname.match(/\/api\/v1\/users\/([^/]+)$/);
    if (userMatch && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: {
            id: MANAGER_USER_ID,
            email: MANAGER_EMAIL,
            name: "Manager User",
            roles: ["manager"],
            merchant_id: "merchant-1",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        }),
      );
    }

    if (pathname === "/api/admin/cashier-balance" && method === "GET") {
      return route.fulfill(json({ success: true, data: { balance: 5_000_000 } }));
    }

    if (pathname === "/api/admin/expenses" && method === "POST") {
      state.lastCreatePayload = request.postDataJSON();
      const transactionDate =
        state.lastCreatePayload.transaction_date ?? new Date().toISOString();
      state.createdExpense = {
        id: "exp-verify-172-5",
        title: state.lastCreatePayload.title,
        description: state.lastCreatePayload.description ?? null,
        amount: String(state.lastCreatePayload.amount),
        source_of_fund: state.lastCreatePayload.source_of_fund,
        receipt_url: state.lastCreatePayload.receipt_url ?? null,
        transaction_date: transactionDate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return route.fulfill(json({ success: true, data: state.createdExpense }, 201));
    }

    const expenseMatch = pathname.match(/^\/api\/admin\/expenses\/([^/]+)$/);
    if (expenseMatch && method === "GET") {
      return route.fulfill(
        json({ success: true, data: state.createdExpense ?? state.defaultExpense }),
      );
    }

    if (pathname.startsWith("/api/admin/expenses") && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: [],
          meta: { page: 1, per_page: 10, total: 0 },
        }),
      );
    }

    return route.continue();
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const state = {
    lastCreatePayload: null,
    createdExpense: null,
    defaultExpense: {
      id: "exp-verify-172-5",
      title: "Placeholder",
      description: null,
      amount: "1000",
      source_of_fund: "PERSONAL_MONEY",
      receipt_url: null,
      transaction_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };

  const managerUser = {
    id: MANAGER_USER_ID,
    email: MANAGER_EMAIL,
    name: "Manager User",
    roles: ["manager"],
    merchant_id: "merchant-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  await installApiMocks(page, state);
  await seedSession(context, page, managerUser);

  await page.goto(`${WEB_BASE}/admin/expenses/new`, { waitUntil: "networkidle" });
  await page.getByTestId("expense-new-page").waitFor({ timeout: 20000 });

  record(
    "Create form shows transaction date field",
    await page.getByTestId("expense-transaction-date-input").isVisible(),
    "Transaction date input visible",
  );

  await page.getByTestId("expense-title-input").fill("Browser test expense");
  await page.getByTestId("expense-amount-input").fill("75000");
  await page.getByTestId("expense-form-submit").click();
  await page.waitForURL("**/admin/expenses/exp-verify-172-5/edit");

  record(
    "Create expense with default date",
    state.lastCreatePayload &&
      !Object.prototype.hasOwnProperty.call(state.lastCreatePayload, "transaction_date") &&
      page.url().includes("/admin/expenses/exp-verify-172-5/edit"),
    "POST omitted transaction_date; redirected to edit",
  );

  await page.goto(`${WEB_BASE}/admin/expenses/new`, { waitUntil: "networkidle" });
  state.lastCreatePayload = null;

  const pastDate = daysAgoWib(5);
  await page.getByTestId("expense-title-input").fill("Backdated expense");
  await page.getByTestId("expense-amount-input").fill("42000");
  await page.getByTestId("expense-transaction-date-input").fill(pastDate);
  await page.getByTestId("expense-form-submit").click();
  await page.waitForURL("**/admin/expenses/exp-verify-172-5/edit");
  await page.getByTestId("expense-transaction-date-card").waitFor({ state: "visible" });

  const transactionDateCard = page.getByTestId("expense-transaction-date-card");
  const transactionDateLabelVisible = await transactionDateCard
    .getByText("Transaction date")
    .isVisible();
  record(
    "Create expense with past transaction date",
    state.lastCreatePayload?.transaction_date === startOfDayWIB(pastDate).toISOString() &&
      transactionDateLabelVisible,
    `sent=${state.lastCreatePayload?.transaction_date}`,
  );

  await page.goto(`${WEB_BASE}/admin/expenses/new`, { waitUntil: "networkidle" });

  const tomorrowStr = addDaysWib(todayWIB(), 1);

  await page.getByTestId("expense-title-input").fill("Future expense");
  await page.getByTestId("expense-amount-input").fill("10000");
  const dateInput = page.getByTestId("expense-transaction-date-input");
  const maxAttr = await dateInput.getAttribute("max");
  await dateInput.fill(tomorrowStr);
  await page.getByTestId("expense-form-submit").click();
  const futureErrorVisible = await page
    .getByText("Transaction date cannot be in the future")
    .isVisible()
    .catch(() => false);

  const blockedByMax = maxAttr !== null && tomorrowStr > maxAttr;
  const stayedOnCreate = page.url().includes("/admin/expenses/new");

  record(
    "Create expense rejects future date in UI",
    (blockedByMax || futureErrorVisible) && stayedOnCreate,
    `tomorrow=${tomorrowStr}; max=${maxAttr}; error=${futureErrorVisible}; stayed=${stayedOnCreate}`,
  );

  await page.goto(`${WEB_BASE}/admin/expenses/new`, { waitUntil: "networkidle" });
  state.lastCreatePayload = null;

  await page.getByTestId("expense-title-input").fill("Cashier backdated");
  await page.getByTestId("expense-amount-input").fill("25000");
  await page.getByTestId("expense-source-of-fund-select").selectOption("CASHIER");
  await page.getByTestId("expense-transaction-date-input").fill(pastDate);
  await page.getByTestId("expense-form-submit").click();
  await page.waitForURL("**/admin/expenses/exp-verify-172-5/edit");

  record(
    "Cashier-funded create with backdated date",
    state.lastCreatePayload?.source_of_fund === "CASHIER" &&
      state.lastCreatePayload?.transaction_date === startOfDayWIB(pastDate).toISOString(),
    "CASHIER payload with backdated transaction_date succeeded",
  );

  await browser.close();

  console.log("\n## Pre-verification");
  for (const [name, status, note] of results) {
    console.log(`- ${name}: ${status}${note ? ` — ${note}` : ""}`);
  }

  if (results.some(([, status]) => status === "FAIL")) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
