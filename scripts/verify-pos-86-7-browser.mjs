#!/usr/bin/env node
/**
 * Browser verification for POS-86-7: cash-flow summary outflow breakdown and production cost.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const MANAGER_EMAIL =
  process.env.TEST_MANAGER_EMAIL ?? "manager-test@cymonevo.com";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "LunaTesting123!";
const MANAGER_USER_ID = "user-manager-verify-86-7";

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

function createCashFlowSummary(period = "daily") {
  const today = formatDateInput(new Date());
  return {
    period,
    totals: {
      inflow_amount: 2_500_000,
      inflow_count: 18,
      outflow_amount: 900_000,
      outflow_count: 5,
      net_amount: 1_600_000,
    },
    buckets: [
      {
        period_start: `${today}T00:00:00.000Z`,
        period_label: period === "daily" ? "Today" : period === "weekly" ? "This week" : "This month",
        inflow_amount: 2_500_000,
        outflow_amount: 900_000,
        net_amount: 1_600_000,
        production_cost_amount: 180_000,
      },
    ],
    inflow_by_method: [
      { method: "CASH", total_amount: 1_500_000, count: 12 },
      { method: "QRIS", total_amount: 1_000_000, count: 6 },
    ],
    outflow_by_source: [
      { source: "purchases", total_amount: 500_000, count: 2 },
      { source: "expenses", total_amount: 250_000, count: 2 },
      { source: "staff_payouts", total_amount: 150_000, count: 1 },
    ],
    production_cost: {
      total_estimated_cost: 180_000,
      completed_request_count: 4,
      items_without_cogs_count: 1,
    },
  };
}

async function installApiMocks(page) {
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

    if (pathname === "/api/admin/insights/cash-flow/summary" && method === "GET") {
      const period = url.searchParams.get("period") ?? "daily";
      return route.fulfill(
        json({ success: true, data: createCashFlowSummary(period) }),
      );
    }

    if (pathname === "/api/admin/insights/transactions/by-menu" && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: {
            date_from: "2026-01-01T00:00:00.000Z",
            date_to: "2026-12-31T23:59:59.999Z",
            total_revenue: 500_000,
            menus: [
              {
                menu_id: "menu-1",
                menu_title: "Nasi Goreng",
                quantity_sold: 10,
                revenue: 300_000,
                revenue_share_percent: 60,
                quantity_share_percent: 50,
              },
            ],
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

    return route.continue();
  });
}

async function seedSession(context, page) {
  const accessToken = makeJwt();
  const refreshToken = makeJwt({ typ: "refresh" });
  const now = Date.now();
  const accessExpiresAt = now + 3600 * 1000;
  const refreshExpiresAt = now + 86400 * 1000;
  const user = {
    id: MANAGER_USER_ID,
    email: MANAGER_EMAIL,
    name: "Manager User",
    roles: ["manager"],
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

async function runChecks(page) {
  await page.goto(`${WEB_BASE}/admin/cash-flow`, { waitUntil: "networkidle" });
  await page.getByTestId("cash-flow-section").waitFor();

  const outflowBreakdown = page.getByTestId("cash-flow-outflow-breakdown");
  await outflowBreakdown.waitFor();
  await outflowBreakdown.getByText("Purchases").first().waitFor();
  await outflowBreakdown.getByText("Expenses").first().waitFor();
  await outflowBreakdown.getByText("Staff payouts").first().waitFor();
  console.log("PASS: Outflow breakdown chart renders purchases, expenses, and staff payouts");

  const productionCostCard = page.getByTestId("cash-flow-production-cost-card");
  await productionCostCard.waitFor();
  await productionCostCard.getByText(formatRupiah(180_000)).waitFor();
  await productionCostCard.getByText("4 completed requests").waitFor();
  await page.getByTestId("cash-flow-production-cost-warning").waitFor();
  console.log("PASS: Production cost card visible with formatted Rupiah amount");

  await page.getByTestId("cash-flow-chart").waitFor();
  await page.getByText("Customer transactions by payment method").waitFor();
  await page.getByRole("button", { name: "Weekly" }).click();
  await page.getByTestId("cash-flow-chart").getByText("This week").waitFor();
  await page.getByRole("button", { name: "Monthly" }).click();
  await page.getByTestId("cash-flow-chart").getByText("This month").waitFor();
  const today = formatDateInput(new Date());
  await page.getByLabel("Cash flow date from").fill(today);
  await page.getByLabel("Cash flow date to").fill(today);
  await page.getByText(formatRupiah(2_500_000)).first().waitFor();
  console.log("PASS: Cash flow chart and period/date filters still work");

  await page.getByTestId("transaction-menu-insights").waitFor();
  await page.getByTestId("production-insight-panel").waitFor();
  console.log("PASS: Transaction menu pie chart and production insight panel remain");
}

async function main() {
  console.log(`POS-86-7 browser verification (WEB_BASE=${WEB_BASE})`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await installApiMocks(page);
    await seedSession(context, page);
    await runChecks(page);
    console.log("All POS-86-7 browser checks passed.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
