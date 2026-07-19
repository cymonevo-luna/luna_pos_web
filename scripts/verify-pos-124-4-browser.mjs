#!/usr/bin/env node
/**
 * Browser verification for POS-124-4: admin delete cashier balance history.
 *
 * Mocked mode (default) exercises UI without luna_pos_service.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ?? "admin-test@cymonevo.com";
const MANAGER_EMAIL =
  process.env.TEST_MANAGER_EMAIL ?? "manager-test@cymonevo.com";
const MOCK_API = !["0", "false", "no"].includes(
  String(process.env.MOCK_API ?? "1").toLowerCase(),
);

const ADMIN_USER_ID = "user-admin-verify-124-4";
const MANAGER_USER_ID = "user-manager-verify-124-4";

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

let currentBalance = 500_000;
const entries = [
  {
    id: "cb-entry-manual",
    type: "DEDUCT",
    source: "MANUAL",
    amount: 50_000,
    purpose: "Manual deduct",
    transaction_id: null,
    requested_by_user_id: ADMIN_USER_ID,
    requested_by_username: "Admin User",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "cb-entry-cash",
    type: "ADD",
    source: "CASH_PAYMENT",
    amount: 25_000,
    purpose: "Cash sale",
    transaction_id: "txn-1",
    requested_by_user_id: MANAGER_USER_ID,
    requested_by_username: "Cashier User",
    created_at: "2026-01-02T00:00:00Z",
  },
];

function resetState() {
  currentBalance = 500_000;
  entries.length = 0;
  entries.push(
    {
      id: "cb-entry-manual",
      type: "DEDUCT",
      source: "MANUAL",
      amount: 50_000,
      purpose: "Manual deduct",
      transaction_id: null,
      requested_by_user_id: ADMIN_USER_ID,
      requested_by_username: "Admin User",
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "cb-entry-cash",
      type: "ADD",
      source: "CASH_PAYMENT",
      amount: 25_000,
      purpose: "Cash sale",
      transaction_id: "txn-1",
      requested_by_user_id: MANAGER_USER_ID,
      requested_by_username: "Cashier User",
      created_at: "2026-01-02T00:00:00Z",
    },
  );
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
      const entry = {
        id: `cb-entry-${entries.length + 1}`,
        type,
        source: "MANUAL",
        amount,
        purpose: body.purpose ?? "",
        transaction_id: null,
        requested_by_user_id: MANAGER_USER_ID,
        requested_by_username: "Manager User",
        created_at: new Date().toISOString(),
      };
      entries.unshift(entry);
      currentBalance += type === "ADD" ? amount : -amount;
      return route.fulfill(json({ success: true, data: entry }));
    }

    const deleteMatch = pathname.match(
      /^\/api\/admin\/cashier-balance\/entries\/([^/]+)$/,
    );
    if (deleteMatch && method === "DELETE") {
      const entryId = deleteMatch[1];
      const index = entries.findIndex((entry) => entry.id === entryId);
      if (index === -1) {
        return route.fulfill(
          json(
            {
              success: false,
              error: { code: "not_found", message: "Entry not found" },
            },
            404,
          ),
        );
      }

      const entry = entries[index];
      if (["CASH_PAYMENT", "CASH_CHANGE", "TRANSACTION_REVERSAL"].includes(entry.source)) {
        return route.fulfill(
          json(
            {
              success: false,
              error: {
                code: "entry_not_deletable",
                message: "Entry cannot be deleted",
              },
            },
            422,
          ),
        );
      }

      entries.splice(index, 1);
      currentBalance += entry.type === "ADD" ? -entry.amount : entry.amount;
      return route.fulfill(
        json({
          success: true,
          data: {
            balance: currentBalance,
            updated_at: new Date().toISOString(),
          },
        }),
      );
    }

    const userMatch = pathname.match(/\/api\/v1\/users\/([^/]+)$/);
    if (userMatch && method === "GET") {
      const userId = userMatch[1];
      const isAdmin = userId === ADMIN_USER_ID;
      const roles = isAdmin ? ["admin"] : ["manager"];
      const email = isAdmin ? ADMIN_EMAIL : MANAGER_EMAIL;
      const features = isAdmin
        ? [
            "cashier_balance.manage",
            "cashier_balance.delete_entry",
            "users.manage",
          ]
        : ["cashier_balance.manage"];

      return route.fulfill(
        json({
          success: true,
          data: {
            id: userId,
            email,
            name: isAdmin ? "Admin User" : "Manager User",
            roles,
            features,
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
  const userId = role === "admin" ? ADMIN_USER_ID : MANAGER_USER_ID;
  const email = role === "admin" ? ADMIN_EMAIL : MANAGER_EMAIL;
  const roles = [role];
  const features =
    role === "admin"
      ? ["cashier_balance.manage", "cashier_balance.delete_entry", "users.manage"]
      : ["cashier_balance.manage"];

  const accessToken = makeJwt({ uid: userId, email, roles, typ: "access" });
  const refreshToken = makeJwt({ uid: userId, email, roles, typ: "refresh" });
  const now = Date.now();
  const accessExpiresAt = now + 3600 * 1000;
  const refreshExpiresAt = now + 86400 * 1000;
  const user = {
    id: userId,
    email,
    name: role === "admin" ? "Admin User" : "Manager User",
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

async function expectAdminDeleteVisible(page) {
  resetState();
  await page.goto(`${WEB_BASE}/admin/cashier-balance`, {
    waitUntil: "networkidle",
  });
  await page.getByTestId("cashier-balance-page").waitFor({ timeout: 15000 });
  await page.getByTestId("cashier-balance-delete-cb-entry-manual").waitFor();
  const cashDelete = page.getByTestId("cashier-balance-delete-cb-entry-cash");
  if (await cashDelete.count()) {
    throw new Error("Delete should be hidden for CASH_PAYMENT row");
  }
  console.log("PASS: Admin sees delete on manual history row");
}

async function expectAdminDeleteUpdatesBalance(page) {
  resetState();
  await page.goto(`${WEB_BASE}/admin/cashier-balance`, {
    waitUntil: "networkidle",
  });
  await page.getByTestId("cashier-balance-amount").waitFor();
  const beforeText = await page.getByTestId("cashier-balance-amount").textContent();

  const deleteResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/cashier-balance/entries/cb-entry-manual") &&
      res.request().method() === "DELETE",
  );

  await page.getByTestId("cashier-balance-delete-cb-entry-manual").click();
  await page.getByTestId("cashier-balance-delete-confirm").click();
  await deleteResponse;

  await page.getByText("Cashier balance history item removed").waitFor();
  await page.getByTestId("cashier-balance-entry-cb-entry-manual").waitFor({
    state: "detached",
    timeout: 10000,
  });
  const afterText = await page.getByTestId("cashier-balance-amount").textContent();
  if (beforeText === afterText) {
    throw new Error("Expected balance to update after delete");
  }
  console.log("PASS: Admin delete updates balance and removes row");
}

async function expectTransactionLinkedNotDeletable(page) {
  resetState();
  await page.goto(`${WEB_BASE}/admin/cashier-balance`, {
    waitUntil: "networkidle",
  });
  await page.getByTestId("cashier-balance-entry-cb-entry-cash").waitFor();
  const cashDelete = page.getByTestId("cashier-balance-delete-cb-entry-cash");
  if (await cashDelete.count()) {
    throw new Error("Delete control should not appear for CASH_PAYMENT row");
  }
  console.log("PASS: Transaction-linked row not deletable in UI");
}

async function expectManagerNoDeleteAndCanAdjust(page, context) {
  await seedSession(context, page, "manager");
  resetState();
  await page.goto(`${WEB_BASE}/admin/cashier-balance`, {
    waitUntil: "networkidle",
  });
  await page.getByTestId("cashier-balance-page").waitFor({ timeout: 15000 });

  if (await page.getByTestId("cashier-balance-delete-cb-entry-manual").count()) {
    throw new Error("Manager should not see delete controls");
  }

  const addResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/cashier-balance/adjustments") &&
      res.request().method() === "POST",
  );
  await page.getByTestId("cashier-balance-add-button").click();
  await page.getByTestId("cashier-balance-amount-input").fill("10000");
  await page.getByTestId("cashier-balance-purpose-input").fill("Manager add");
  await page.getByTestId("cashier-balance-submit").click();
  await addResponse;
  await page.getByText("Cash added to cashier balance").waitFor();

  const deductResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/cashier-balance/adjustments") &&
      res.request().method() === "POST",
  );
  await page.getByTestId("cashier-balance-deduct-button").click();
  await page.getByTestId("cashier-balance-amount-input").fill("5000");
  await page.getByTestId("cashier-balance-purpose-input").fill("Manager deduct");
  await page.getByTestId("cashier-balance-submit").click();
  await deductResponse;
  await page.getByText("Cash deducted from cashier balance").waitFor();

  console.log("PASS: Manager can add and deduct without delete controls");
}

async function main() {
  console.log(
    `POS-124-4 browser verification (MOCK_API=${MOCK_API}, WEB_BASE=${WEB_BASE})`,
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  if (MOCK_API) {
    await installApiMocks(page);
  }

  await seedSession(context, page, "admin");

  await expectAdminDeleteVisible(page);
  await expectAdminDeleteUpdatesBalance(page);
  await expectTransactionLinkedNotDeletable(page);
  await expectManagerNoDeleteAndCanAdjust(page, context);

  await browser.close();
  console.log("All POS-124-4 browser checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
