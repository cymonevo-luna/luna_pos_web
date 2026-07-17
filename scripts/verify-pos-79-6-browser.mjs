#!/usr/bin/env node
/**
 * Browser verification for POS-79-6: cash-flow insights reflects expense outflows.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const MANAGER_EMAIL =
  process.env.TEST_MANAGER_EMAIL ?? "manager-test@cymonevo.com";
const OPERATIONAL_EMAIL =
  process.env.TEST_OPERATIONAL_EMAIL ?? "operation-test@cymonevo.com";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "LunaTesting123!";
const EXPENSE_AMOUNT = 100_000;

const MANAGER_USER_ID = "user-manager-verify-79-6";
const OPERATIONAL_USER_ID = "user-operational-verify-79-6";

function makeJwt(claims = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url",
  );
  const body = Buffer.from(
    JSON.stringify({
      uid: claims.uid ?? MANAGER_USER_ID,
      email: claims.email ?? MANAGER_EMAIL,
      roles: claims.roles ?? ["manager"],
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

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatRupiah(amount) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function createCashFlowStore() {
  const baseInflow = 2_000_000;
  const baseOutflow = 500_000;
  const expenses = [];

  return {
    expenses,
    recordExpense(amount) {
      expenses.push({ amount, created_at: new Date().toISOString() });
    },
    expenseTotal() {
      return expenses.reduce((sum, expense) => sum + expense.amount, 0);
    },
    summary() {
      const outflowAmount = baseOutflow + this.expenseTotal();
      const netAmount = baseInflow - outflowAmount;
      const today = formatDateInput(new Date());
      return {
        period: "daily",
        totals: {
          inflow_amount: baseInflow,
          inflow_count: 12,
          outflow_amount: outflowAmount,
          outflow_count: 2 + expenses.length,
          net_amount: netAmount,
        },
        buckets: [
          {
            period_start: `${today}T00:00:00.000Z`,
            period_label: "Today",
            inflow_amount: baseInflow,
            outflow_amount: outflowAmount,
            net_amount: netAmount,
          },
        ],
        inflow_by_method: [
          { method: "CASH", total_amount: 1_200_000, count: 8 },
          { method: "QRIS", total_amount: 800_000, count: 4 },
        ],
      };
    },
    baseInflow,
    baseOutflow,
  };
}

async function installApiMocks(page, store) {
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
      const userId = userMatch[1];
      const isOperational = userId === OPERATIONAL_USER_ID;
      return route.fulfill(
        json({
          success: true,
          data: {
            id: userId,
            email: isOperational ? OPERATIONAL_EMAIL : MANAGER_EMAIL,
            name: isOperational ? "Operational User" : "Manager User",
            roles: isOperational ? ["operational"] : ["manager"],
            merchant_id: "merchant-1",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        }),
      );
    }

    if (pathname === "/api/admin/insights/cash-flow/summary" && method === "GET") {
      return route.fulfill(json({ success: true, data: store.summary() }));
    }

    if (pathname === "/api/admin/insights/transactions/by-menu" && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: {
            date_from: "2026-01-01T00:00:00.000Z",
            date_to: "2026-12-31T23:59:59.999Z",
            total_revenue: 0,
            menus: [],
          },
        }),
      );
    }

    if (pathname === "/api/admin/insights/production/next-day" && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: {
            target_date: formatDateInput(new Date()),
            lookback_days: 14,
            generated_at: new Date().toISOString(),
            menus: [],
          },
        }),
      );
    }

    if (pathname === "/api/admin/expenses" && method === "POST") {
      const payload = request.postDataJSON();
      store.recordExpense(payload.amount);
      return route.fulfill(
        json(
          {
            success: true,
            data: {
              id: `exp-verify-79-6-${store.expenses.length}`,
              title: payload.title,
              description: payload.description ?? null,
              amount: payload.amount,
              receipt_url: payload.receipt_url ?? null,
              created_by_user_id: payload.created_by_user_id ?? OPERATIONAL_USER_ID,
              created_by_username: "Operational User",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          },
          201,
        ),
      );
    }

    if (pathname === "/api/admin/expenses" && method === "GET") {
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

async function seedSession(context, page, user) {
  const accessToken = makeJwt({
    uid: user.id,
    email: user.email,
    roles: user.roles,
    typ: "access",
  });
  const refreshToken = makeJwt({
    uid: user.id,
    email: user.email,
    roles: user.roles,
    typ: "refresh",
  });
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

async function setCashFlowDateRangeToToday(page) {
  const today = formatDateInput(new Date());
  const fromInput = page.getByLabel("Cash flow date from");
  const toInput = page.getByLabel("Cash flow date to");
  await fromInput.fill(today);
  await toInput.fill(today);
}

async function runChecks(page, context, store) {
  const managerUser = {
    id: MANAGER_USER_ID,
    email: MANAGER_EMAIL,
    name: "Manager User",
    roles: ["manager"],
    merchant_id: "merchant-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  await seedSession(context, page, managerUser);
  await page.goto(`${WEB_BASE}/admin/cash-flow`, { waitUntil: "networkidle" });
  await page.getByTestId("cash-flow-section").waitFor();
  await setCashFlowDateRangeToToday(page);

  const initialOutflow = store.baseOutflow;
  const initialNet = store.baseInflow - initialOutflow;
  await page.getByText(formatRupiah(initialOutflow)).first().waitFor();
  await page.getByText(formatRupiah(initialNet)).first().waitFor();
  await page.getByText(formatRupiah(store.baseInflow)).first().waitFor();
  console.log("PASS: Manager sees initial cash-flow outflow and net for today");

  const operationalUser = {
    id: OPERATIONAL_USER_ID,
    email: OPERATIONAL_EMAIL,
    name: "Operational User",
    roles: ["operational"],
    merchant_id: "merchant-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
  await seedSession(context, page, operationalUser);
  await page.goto(`${WEB_BASE}/admin/expenses/new`, { waitUntil: "networkidle" });
  await page.getByTestId("expense-title-input").fill("POS-79-6 verify expense");
  await page.getByTestId("expense-amount-input").fill(String(EXPENSE_AMOUNT));
  const createResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/expenses") &&
      res.request().method() === "POST" &&
      res.status() === 201,
  );
  await page.getByTestId("expense-form-submit").click();
  await createResponse;
  console.log("PASS: Operational user created expense");

  await seedSession(context, page, managerUser);
  await page.goto(`${WEB_BASE}/admin/cash-flow`, { waitUntil: "networkidle" });
  await page.getByTestId("cash-flow-section").waitFor();
  await setCashFlowDateRangeToToday(page);

  const updatedOutflow = initialOutflow + EXPENSE_AMOUNT;
  const updatedNet = store.baseInflow - updatedOutflow;
  await page.getByText(formatRupiah(updatedOutflow)).first().waitFor();
  await page.getByText(formatRupiah(updatedNet)).first().waitFor();
  await page.getByText(formatRupiah(store.baseInflow)).first().waitFor();
  await page.getByTestId("cash-flow-chart").waitFor();
  await page.getByTestId("cash-flow-inflow-by-method").waitFor();
  console.log("PASS: Outflow increased and net decreased after expense");

  await seedSession(context, page, operationalUser);
  await page.goto(`${WEB_BASE}/admin/cash-flow`, { waitUntil: "networkidle" });
  await page.waitForURL("**/admin/suppliers", { timeout: 10000 });
  console.log("PASS: Operational user blocked from cash-flow insights");

  await seedSession(context, page, managerUser);
  await page.goto(`${WEB_BASE}/admin/cash-flow`, { waitUntil: "networkidle" });
  const inflowLegend = page.getByTestId("cash-flow-inflow-by-method");
  await inflowLegend.waitFor();
  await inflowLegend.getByText("CASH", { exact: true }).waitFor();
  await inflowLegend.getByText("QRIS", { exact: true }).waitFor();
  console.log("PASS: Inflow display and inflow_by_method still render");
}

async function main() {
  console.log(`POS-79-6 browser verification (WEB_BASE=${WEB_BASE})`);

  const store = createCashFlowStore();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await installApiMocks(page, store);
  await runChecks(page, context, store);

  await browser.close();
  console.log("All POS-79-6 browser checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
