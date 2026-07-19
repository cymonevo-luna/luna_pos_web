#!/usr/bin/env node
/**
 * Browser verification for POS-124-6: expense source of fund on create form.
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const MANAGER_EMAIL =
  process.env.TEST_MANAGER_EMAIL ?? "manager-test@cymonevo.com";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "LunaTesting123!";
const MOCK_API = !["0", "false", "no"].includes(
  String(process.env.MOCK_API ?? "1").toLowerCase(),
);

const MANAGER_USER_ID = "user-manager-verify-124-6";

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

function createMockStore() {
  const expenses = new Map();
  const entries = [];
  let nextExpenseId = 1;
  let nextEntryId = 1;
  let receiptCounter = 1;
  let cashierBalance = 200_000;

  return {
    expenses,
    entries,
    get cashierBalance() {
      return cashierBalance;
    },
    setCashierBalance(value) {
      cashierBalance = value;
    },
    createExpense(payload) {
      const id = `exp-verify-124-6-${nextExpenseId++}`;
      const expense = {
        id,
        title: payload.title,
        description: payload.description ?? null,
        amount: payload.amount,
        source_of_fund: payload.source_of_fund ?? "PERSONAL_MONEY",
        receipt_url: payload.receipt_url ?? null,
        created_by_user_id: payload.created_by_user_id ?? MANAGER_USER_ID,
        created_by_username: payload.created_by_username ?? "Manager User",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (payload.source_of_fund === "CASHIER") {
        if (cashierBalance < payload.amount) {
          return {
            error: {
              code: "insufficient_balance",
              message: "Insufficient cashier balance for this expense",
              fields: {
                source_of_fund: "Insufficient cashier balance for this expense",
              },
            },
            status: 422,
          };
        }
        cashierBalance -= payload.amount;
        const entryId = `cb-entry-${nextEntryId++}`;
        entries.unshift({
          id: entryId,
          type: "EXPENSE",
          amount: payload.amount,
          purpose: payload.title,
          transaction_id: id,
          requested_by_user_id: MANAGER_USER_ID,
          requested_by_username: "Manager User",
          created_at: new Date().toISOString(),
        });
      }

      expenses.set(id, expense);
      return { data: expense };
    },
    nextReceiptUrl() {
      return `https://example.com/uploads/receipt-verify-124-6-${receiptCounter++}.jpg`;
    },
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
      return route.fulfill(
        json({
          success: true,
          data: {
            id: userMatch[1],
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
      return route.fulfill(
        json({
          success: true,
          data: {
            balance: String(store.cashierBalance),
            updated_at: new Date().toISOString(),
          },
        }),
      );
    }

    if (pathname === "/api/admin/cashier-balance/entries" && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: store.entries,
          meta: { page: 1, per_page: 10, total: store.entries.length },
        }),
      );
    }

    if (pathname === "/api/admin/expenses" && method === "GET") {
      const data = [...store.expenses.values()];
      return route.fulfill(
        json({
          success: true,
          data,
          meta: { page: 1, per_page: 10, total: data.length },
        }),
      );
    }

    if (pathname === "/api/admin/expenses" && method === "POST") {
      const payload = request.postDataJSON();
      const result = store.createExpense(payload);
      if (result.error) {
        return route.fulfill(
          json({ success: false, error: result.error }, result.status),
        );
      }
      return route.fulfill(json({ success: true, data: result.data }, 201));
    }

    if (
      pathname === "/api/admin/uploads/expense-receipt" &&
      method === "POST"
    ) {
      return route.fulfill(
        json(
          {
            success: true,
            data: {
              url: store.nextReceiptUrl(),
              filename: "receipt.jpg",
              size_bytes: 512,
            },
          },
          201,
        ),
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

async function fillExpenseForm(page, { title, amount, sourceOfFund }) {
  await page.getByTestId("expense-title-input").fill(title);
  await page.getByTestId("expense-amount-input").fill(String(amount));
  if (sourceOfFund) {
    await page.getByTestId("expense-source-of-fund-select").selectOption(sourceOfFund);
  }
}

async function submitCreateForm(page) {
  await page.getByTestId("expense-form-submit").click();
}

async function testSourceOfFundDropdown(page) {
  await page.goto(`${WEB_BASE}/admin/expenses/new`, { waitUntil: "networkidle" });
  await page.getByTestId("expense-new-page").waitFor();

  const select = page.getByTestId("expense-source-of-fund-select");
  await select.waitFor();
  await page.getByText("Source of Fund", { exact: true }).waitFor();

  const value = await select.inputValue();
  if (value !== "PERSONAL_MONEY") {
    throw new Error(`Expected default PERSONAL_MONEY, got ${value}`);
  }

  const options = await select.locator("option").allTextContents();
  if (!options.includes("Cashier") || !options.includes("Personal Money")) {
    throw new Error(`Expected Cashier and Personal Money options, got ${options.join(", ")}`);
  }

  console.log("PASS: Create Expense form shows Source of Fund dropdown");
}

async function testPersonalMoneyNoCashierImpact(page, store) {
  const beforeBalance = store.cashierBalance;

  await page.goto(`${WEB_BASE}/admin/expenses/new`, { waitUntil: "networkidle" });
  await fillExpenseForm(page, {
    title: "Office supplies",
    amount: 50_000,
    sourceOfFund: "PERSONAL_MONEY",
  });

  const createResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/expenses") &&
      res.request().method() === "POST",
  );
  await submitCreateForm(page);
  const response = await createResponse;
  if (!response.ok()) {
    throw new Error(`Personal Money expense create failed: ${response.status()}`);
  }

  await page.getByText("Expense created").waitFor();
  await page.goto(`${WEB_BASE}/admin/cashier-balance`, { waitUntil: "networkidle" });
  await page.getByTestId("cashier-balance-amount").waitFor();

  if (store.cashierBalance !== beforeBalance) {
    throw new Error(
      `Cashier balance changed after Personal Money expense: ${beforeBalance} -> ${store.cashierBalance}`,
    );
  }

  console.log("PASS: Personal Money expense creates without cashier impact");
}

async function testCashierExpenseDeductsBalance(page, store) {
  store.setCashierBalance(300_000);
  const beforeBalance = store.cashierBalance;
  const amount = 75_000;

  await page.goto(`${WEB_BASE}/admin/expenses/new`, { waitUntil: "networkidle" });
  await fillExpenseForm(page, {
    title: "Petty cash",
    amount,
    sourceOfFund: "CASHIER",
  });

  const createResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/expenses") &&
      res.request().method() === "POST",
  );
  await submitCreateForm(page);
  const response = await createResponse;
  if (!response.ok()) {
    throw new Error(`Cashier expense create failed: ${response.status()}`);
  }

  await page.getByText("Expense created").waitFor();

  if (store.cashierBalance !== beforeBalance - amount) {
    throw new Error(
      `Expected balance ${beforeBalance - amount}, got ${store.cashierBalance}`,
    );
  }

  await page.goto(`${WEB_BASE}/admin/cashier-balance`, { waitUntil: "networkidle" });
  await page.getByTestId("cashier-balance-amount").waitFor();

  const expenseEntry = store.entries.find((entry) => entry.type === "EXPENSE");
  if (!expenseEntry) {
    throw new Error("Expected EXPENSE entry in cashier balance history");
  }

  console.log("PASS: Cashier expense deducts cashier balance");
}

async function testInsufficientBalanceError(page, store) {
  store.setCashierBalance(10_000);
  const expensesBefore = store.expenses.size;

  await page.goto(`${WEB_BASE}/admin/expenses/new`, { waitUntil: "networkidle" });
  await fillExpenseForm(page, {
    title: "Large purchase",
    amount: 50_000,
    sourceOfFund: "CASHIER",
  });

  const createResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/expenses") &&
      res.request().method() === "POST",
  );
  await submitCreateForm(page);
  const response = await createResponse;
  if (response.status() !== 422) {
    throw new Error(`Expected 422 insufficient_balance, got ${response.status()}`);
  }

  await page.getByTestId("expense-source-of-fund-error").waitFor();
  const errorText = await page
    .getByTestId("expense-source-of-fund-error")
    .textContent();
  if (!errorText?.toLowerCase().includes("insufficient")) {
    throw new Error(`Expected insufficient balance error text, got ${errorText}`);
  }

  if (store.expenses.size !== expensesBefore) {
    throw new Error("Expense should not be created when balance is insufficient");
  }

  console.log("PASS: Insufficient cashier balance shows error");
}

async function testReceiptUploadRegression(page) {
  await page.goto(`${WEB_BASE}/admin/expenses/new`, { waitUntil: "networkidle" });

  await fillExpenseForm(page, {
    title: "Receipt expense",
    amount: 25_000,
    sourceOfFund: "PERSONAL_MONEY",
  });

  const fixturePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "fixtures",
    "receipt-verify-79-3.jpg",
  );
  const uploadResponse = page.waitForResponse((res) =>
    res.url().includes("/api/admin/uploads/expense-receipt"),
  );
  await page.getByTestId("expense-receipt-file-input").setInputFiles(fixturePath);
  await uploadResponse;

  const createResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/expenses") &&
      res.request().method() === "POST",
  );
  await submitCreateForm(page);
  const response = await createResponse;
  if (!response.ok()) {
    throw new Error(`Receipt upload create failed: ${response.status()}`);
  }

  await page.getByText("Expense created").waitFor();
  console.log("PASS: Regression: expense create with receipt upload still works");
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const store = createMockStore();

  if (MOCK_API) {
    await installApiMocks(page, store);
  }

  await seedSession(context, page);

  try {
    await testSourceOfFundDropdown(page);
    await testPersonalMoneyNoCashierImpact(page, store);
    await testCashierExpenseDeductsBalance(page, store);
    await testInsufficientBalanceError(page, store);
    await testReceiptUploadRegression(page);
    console.log("\nAll POS-124-6 browser checks passed.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
