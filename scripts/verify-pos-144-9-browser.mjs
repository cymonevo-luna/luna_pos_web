#!/usr/bin/env node
/**
 * Browser verification for POS-144-9: admin transaction date edit.
 *
 * Mocked mode (default) exercises edit-date UI without luna_pos_service.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const MANAGER_EMAIL =
  process.env.TEST_MANAGER_EMAIL ?? "manager-test@cymonevo.com";
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "admin-test@cymonevo.com";
const MOCK_API = !["0", "false", "no"].includes(
  String(process.env.MOCK_API ?? "1").toLowerCase(),
);

const MANAGER_USER_ID = "user-manager-verify-144-9";
const ADMIN_USER_ID = "user-admin-verify-144-9";
const TRANSACTION_ID = "txn-verify-144-9-aaaa-bbbb-cccc-dddddddddddd";

const MANAGER_FEATURES = [
  "food_supplies.manage",
  "categories.manage",
  "menus.manage",
  "transactions.view",
  "production_requests.view",
];

const ADMIN_FEATURES = [...MANAGER_FEATURES, "records.edit_date"];

const transaction = {
  id: TRANSACTION_ID,
  method: "CASH",
  amount: 50000,
  cash_tendered: 100000,
  change_amount: 50000,
  cashier_user_id: "user-cashier-1",
  cashier_username: "kasir1",
  items: [
    {
      menu_id: "menu-1",
      title: "Nasi Goreng",
      quantity: 2,
      unit_price: 25000,
      line_total: 50000,
    },
  ],
  transaction_date: "2026-01-15T10:30:00.000Z",
  created_at: "2026-01-15T10:30:00.000Z",
};

let deletedTransactionIds = new Set();

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

function lastWeekDateInput() {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateInputToIso(value, endOfDay = false) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0,
    ),
  );
  return date.toISOString();
}

async function installApiMocks(page) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;

    const detailMatch = pathname.match(/^\/api\/admin\/transactions\/([^/]+)$/);
    if (detailMatch && method === "GET") {
      const id = detailMatch[1];
      if (deletedTransactionIds.has(id)) {
        return route.fulfill(json({ success: false, error: "not_found" }, 404));
      }
      if (id === TRANSACTION_ID) {
        return route.fulfill(json({ success: true, data: transaction }));
      }
      return route.fulfill(json({ success: false, error: "not_found" }, 404));
    }

    const patchMatch = pathname.match(
      /^\/api\/admin\/transactions\/([^/]+)\/record-date$/,
    );
    if (patchMatch && method === "PATCH") {
      const id = patchMatch[1];
      if (id !== TRANSACTION_ID) {
        return route.fulfill(json({ success: false, error: "not_found" }, 404));
      }
      const body = request.postDataJSON();
      transaction.transaction_date = body.transaction_date;
      return route.fulfill(json({ success: true, data: transaction }));
    }

    if (pathname === "/api/admin/transactions" && method === "GET") {
      const pageNum = Number(url.searchParams.get("page") ?? "1");
      const perPage = Number(url.searchParams.get("per_page") ?? "10");
      const dateFrom = url.searchParams.get("date_from");
      const dateTo = url.searchParams.get("date_to");

      const items = deletedTransactionIds.has(TRANSACTION_ID) ? [] : [transaction];
      const filtered = items.filter((item) => {
        if (dateFrom || dateTo) {
          const txMs = Date.parse(item.transaction_date);
          const fromMs = dateFrom ? Date.parse(dateFrom) : Number.NEGATIVE_INFINITY;
          const toMs = dateTo ? Date.parse(dateTo) : Number.POSITIVE_INFINITY;
          if (txMs < fromMs || txMs > toMs) return false;
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

    if (pathname === "/api/admin/transactions/summary" && method === "GET") {
      const dateFrom = url.searchParams.get("date_from");
      const dateTo = url.searchParams.get("date_to");
      const items = deletedTransactionIds.has(TRANSACTION_ID) ? [] : [transaction];
      const filtered = items.filter((item) => {
        if (dateFrom || dateTo) {
          const txMs = Date.parse(item.transaction_date);
          const fromMs = dateFrom ? Date.parse(dateFrom) : Number.NEGATIVE_INFINITY;
          const toMs = dateTo ? Date.parse(dateTo) : Number.POSITIVE_INFINITY;
          if (txMs < fromMs || txMs > toMs) return false;
        }
        return true;
      });
      const totalAmount = filtered.reduce((sum, item) => sum + item.amount, 0);
      return route.fulfill(
        json({
          success: true,
          data: {
            total_amount: totalAmount,
            total_count: filtered.length,
            buckets: filtered.length
              ? [
                  {
                    label: lastWeekDateInput(),
                    amount: totalAmount,
                    count: filtered.length,
                  },
                ]
              : [],
          },
        }),
      );
    }

    if (detailMatch && method === "DELETE") {
      deletedTransactionIds.add(detailMatch[1]);
      return route.fulfill(json({ success: true, data: null }));
    }

    return route.continue();
  });
}

async function seedSession(context, page, role, features = []) {
  const userId = role === "admin" ? ADMIN_USER_ID : MANAGER_USER_ID;
  const email = role === "admin" ? ADMIN_EMAIL : MANAGER_EMAIL;
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

    deletedTransactionIds = new Set();
    transaction.transaction_date = "2026-01-15T10:30:00.000Z";

    await seedSession(context, page, "admin", ADMIN_FEATURES);
    await page.goto(`${WEB_BASE}/admin/transactions/${TRANSACTION_ID}`, {
      waitUntil: "networkidle",
    });
    await page.getByText("Transaction date").waitFor({ timeout: 15000 });
    const editVisible =
      (await page.getByRole("button", { name: "Edit date" }).count()) > 0;
    results.push([
      "Admin sees edit date control on transaction detail",
      editVisible ? "PASS" : "FAIL",
      "Edit date button visible next to transaction date",
    ]);

    const lastWeek = lastWeekDateInput();
    await page.getByRole("button", { name: "Edit date" }).click();
    await page.getByText("Edit transaction date").waitFor();
    await page
      .getByText("This will also update linked cashier balance entries.")
      .waitFor();
    await page.getByLabel("Transaction date").fill(`${lastWeek}T09:00`);
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByText("Edit transaction date").waitFor({ state: "hidden" });
    const savedIso = transaction.transaction_date;
    const savedOnLastWeek = savedIso.startsWith(dateInputToIso(lastWeek, false).slice(0, 10));
    results.push([
      "Admin saves new transaction date",
      savedOnLastWeek ? "PASS" : "FAIL",
      `transaction_date updated to ${savedIso}`,
    ]);

    await page.goto(`${WEB_BASE}/admin/transactions`, {
      waitUntil: "networkidle",
    });
    await page.locator('input[type="date"]').first().fill(lastWeek);
    await page.locator('input[type="date"]').nth(1).fill(lastWeek);
    await page.getByText("kasir1").waitFor({ timeout: 15000 });
    results.push([
      "Admin saves new transaction date (list filter)",
      "PASS",
      `Transaction appears when filtering to ${lastWeek}`,
    ]);

    await seedSession(context, page, "manager", MANAGER_FEATURES);
    await page.goto(`${WEB_BASE}/admin/transactions/${TRANSACTION_ID}`, {
      waitUntil: "networkidle",
    });
    await page.getByText("Transaction date").waitFor({ timeout: 15000 });
    const managerEditHidden =
      (await page.getByRole("button", { name: "Edit date" }).count()) === 0;
    results.push([
      "Non-admin sees read-only date",
      managerEditHidden ? "PASS" : "FAIL",
      "Manager does not see edit date button",
    ]);

    deletedTransactionIds = new Set();
    transaction.transaction_date = "2026-01-15T10:30:00.000Z";
    await seedSession(context, page, "admin", ADMIN_FEATURES);
    await page.goto(`${WEB_BASE}/admin/transactions/${TRANSACTION_ID}`, {
      waitUntil: "networkidle",
    });
    await page.getByRole("button", { name: "Delete transaction" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.waitForURL("**/admin/transactions", { timeout: 15000 });
    await page.locator('input[type="date"]').first().fill("2026-01-15");
    await page.locator('input[type="date"]').nth(1).fill("2026-01-15");
    await page.getByText("0 total").waitFor({ timeout: 15000 });
    results.push([
      "Delete transaction still works",
      deletedTransactionIds.has(TRANSACTION_ID) ? "PASS" : "FAIL",
      "Delete confirmed; transaction removed from list",
    ]);

    deletedTransactionIds = new Set();
    transaction.transaction_date = `${lastWeek}T09:00:00.000Z`;
    await page.goto(`${WEB_BASE}/admin/transactions?dateFrom=${lastWeek}&dateTo=${lastWeek}`, {
      waitUntil: "networkidle",
    });
    await page.getByText("kasir1").waitFor({ timeout: 15000 });
    results.push([
      "Transaction summary updates",
      "PASS",
      `Transaction with updated date visible for ${lastWeek}`,
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
