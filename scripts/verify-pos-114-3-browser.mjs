#!/usr/bin/env node
/**
 * Browser verification for POS-114-3: cashier balance admin page.
 *
 * Mocked mode (default) exercises UI without luna_pos_service.
 * Set MOCK_API=0 to hit a live API.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const MANAGER_EMAIL =
  process.env.TEST_MANAGER_EMAIL ?? "manager-test@cymonevo.com";
const CASHIER_EMAIL =
  process.env.TEST_CASHIER_EMAIL ?? "cashier-test@cymonevo.com";
const MOCK_API = !["0", "false", "no"].includes(
  String(process.env.MOCK_API ?? "1").toLowerCase(),
);

const MANAGER_USER_ID = "user-manager-verify-114-3";
const CASHIER_USER_ID = "user-cashier-verify-114-3";

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

let currentBalance = 100_000;
const entries = [];

function resetState() {
  currentBalance = 100_000;
  entries.length = 0;
}

async function installApiMocks(page) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;

    if (pathname === "/api/admin/cashier-balance" && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: {
            balance: currentBalance,
            updated_at: "2026-01-01T00:00:00Z",
          },
        }),
      );
    }

    if (pathname === "/api/admin/cashier-balance/entries" && method === "GET") {
      const pageNum = Number(url.searchParams.get("page") ?? "1");
      const perPage = Number(url.searchParams.get("per_page") ?? "10");
      const start = (pageNum - 1) * perPage;
      const slice = entries.slice(start, start + perPage);

      return route.fulfill(
        json({
          success: true,
          data: slice,
          meta: { page: pageNum, per_page: perPage, total: entries.length },
        }),
      );
    }

    if (
      pathname === "/api/admin/cashier-balance/adjustments" &&
      method === "POST"
    ) {
      const body = request.postDataJSON();
      const amount = Number(body.amount);
      const type = body.type;
      const purpose = body.purpose ?? "";
      const entry = {
        id: `cb-entry-${entries.length + 1}`,
        type,
        amount,
        purpose,
        transaction_id: null,
        requested_by_user_id: MANAGER_USER_ID,
        requested_by_username: "Manager User",
        created_at: new Date().toISOString(),
      };
      entries.unshift(entry);
      currentBalance += type === "ADD" ? amount : -amount;
      return route.fulfill(json({ success: true, data: entry }));
    }

  const userMatch = pathname.match(/\/api\/v1\/users\/([^/]+)$/);
    if (userMatch && method === "GET") {
      const userId = userMatch[1];
      const roles = userId === CASHIER_USER_ID ? ["cashier"] : ["manager"];
      const email = userId === CASHIER_USER_ID ? CASHIER_EMAIL : MANAGER_EMAIL;

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

    return route.continue();
  });
}

async function seedSession(context, page, role) {
  const userId = role === "cashier" ? CASHIER_USER_ID : MANAGER_USER_ID;
  const email = role === "cashier" ? CASHIER_EMAIL : MANAGER_EMAIL;
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

async function expectManagerNav(page) {
  await page.goto(`${WEB_BASE}/admin`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Cash Flow" }).click();
  await page.getByRole("link", { name: "Cashier Balance", exact: true }).waitFor();
  console.log("PASS: Admin nav shows Cashier Balance for manager");
}

async function expectBalanceLoads(page) {
  await page.goto(`${WEB_BASE}/admin/cashier-balance`, {
    waitUntil: "networkidle",
  });
  await page.getByTestId("cashier-balance-page").waitFor({ timeout: 15000 });
  await page.getByTestId("cashier-balance-amount").waitFor();
  const amountText = await page.getByTestId("cashier-balance-amount").textContent();
  if (!amountText?.includes("Rp")) {
    throw new Error(`Expected formatted Rupiah balance, got ${amountText}`);
  }
  console.log("PASS: Cashier Balance page loads balance");
}

async function expectManualAdd(page) {
  resetState();
  await page.goto(`${WEB_BASE}/admin/cashier-balance`, {
    waitUntil: "networkidle",
  });
  await page.getByTestId("cashier-balance-amount").waitFor();
  const beforeText = await page.getByTestId("cashier-balance-amount").textContent();

  const createResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/cashier-balance/adjustments") &&
      res.request().method() === "POST",
  );

  await page.getByTestId("cashier-balance-add-button").click();
  await page.getByTestId("cashier-balance-amount-input").fill("50000");
  await page.getByTestId("cashier-balance-purpose-input").fill("Web test");
  await page.getByTestId("cashier-balance-submit").click();
  await createResponse;

  await page.getByText("Cash added to cashier balance").waitFor();
  await page.getByTestId("cashier-balance-entry-cb-entry-1").waitFor();
  const afterText = await page.getByTestId("cashier-balance-amount").textContent();
  if (beforeText === afterText) {
    throw new Error("Expected balance to increase after add");
  }
  await page.getByTestId("cashier-balance-entry-amount-cb-entry-1").waitFor();
  const amountCell = await page
    .getByTestId("cashier-balance-entry-amount-cb-entry-1")
    .textContent();
  if (!amountCell?.includes("+")) {
    throw new Error(`Expected positive signed amount, got ${amountCell}`);
  }
  console.log("PASS: Manual add from web updates balance");
}

async function expectManualDeduct(page) {
  await page.getByTestId("cashier-balance-deduct-button").click();
  await page.locator("#adjustment-type").selectOption("DEDUCT");

  const createResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/cashier-balance/adjustments") &&
      res.request().method() === "POST",
  );

  await page.getByTestId("cashier-balance-amount-input").fill("25000");
  await page.getByTestId("cashier-balance-purpose-input").fill("Petty cash");
  await page.getByTestId("cashier-balance-submit").click();
  await createResponse;

  await page.getByText("Cash deducted from cashier balance").waitFor();
  const deductRow = page.getByTestId("cashier-balance-entry-cb-entry-2");
  await deductRow.waitFor();
  const amountCell = await page
    .getByTestId("cashier-balance-entry-amount-cb-entry-2")
    .textContent();
  if (!amountCell?.includes("-")) {
    throw new Error(`Expected negative signed amount, got ${amountCell}`);
  }
  console.log("PASS: Manual deduct from web updates balance");
}

async function expectCashierBlocked(page, context) {
  await seedSession(context, page, "cashier");
  await page.goto(`${WEB_BASE}/admin/cashier-balance`, {
    waitUntil: "networkidle",
  });
  await page.waitForURL((url) => !url.pathname.startsWith("/admin/cashier-balance"), {
    timeout: 15000,
  });
  const pathname = new URL(page.url()).pathname;
  if (pathname.startsWith("/admin/cashier-balance")) {
    throw new Error(`Cashier should not remain on cashier balance page, got ${pathname}`);
  }
  console.log(`PASS: Cashier blocked from admin page (redirected to ${pathname})`);
}

async function main() {
  console.log(
    `POS-114-3 browser verification (MOCK_API=${MOCK_API}, WEB_BASE=${WEB_BASE})`,
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  if (MOCK_API) {
    await installApiMocks(page);
    await seedSession(context, page, "manager");
    await expectManagerNav(page);
    await expectBalanceLoads(page);
    await expectManualAdd(page);
    await expectManualDeduct(page);
    await expectCashierBlocked(page, context);
  } else {
    await seedSession(context, page, "manager");
    await page.goto(`${WEB_BASE}/admin/cashier-balance`, {
      waitUntil: "networkidle",
    });
    await page.getByTestId("cashier-balance-page").waitFor({ timeout: 15000 });
    console.log("PASS: Cashier Balance page loads (live API)");
  }

  await browser.close();
  console.log("All POS-114-3 browser checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
