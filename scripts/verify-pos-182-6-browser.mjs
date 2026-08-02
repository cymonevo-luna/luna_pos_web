#!/usr/bin/env node
/**
 * Browser verification for POS-182-6: QRIS source of fund on expense forms.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const MANAGER_EMAIL =
  process.env.TEST_MANAGER_EMAIL ?? "manager-test@cymonevo.com";
const MANAGER_USER_ID = "user-manager-verify-182-6";

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
  let nextExpenseId = 1;
  let cashierBalance = 500_000;
  let qrisBalance = 300_000;

  return {
    expenses,
    get cashierBalance() {
      return cashierBalance;
    },
    get qrisBalance() {
      return qrisBalance;
    },
    setCashierBalance(value) {
      cashierBalance = value;
    },
    setQrisBalance(value) {
      qrisBalance = value;
    },
    createExpense(payload) {
      const id = `exp-verify-182-6-${nextExpenseId++}`;
      const expense = {
        id,
        title: payload.title,
        description: payload.description ?? null,
        amount: payload.amount,
        source_of_fund: payload.source_of_fund ?? "PERSONAL_MONEY",
        receipt_url: payload.receipt_url ?? null,
        created_by_user_id: MANAGER_USER_ID,
        created_by_username: "Manager User",
        transaction_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (payload.source_of_fund === "CASHIER") {
        if (cashierBalance < payload.amount) {
          return {
            error: {
              code: "insufficient_balance",
              message: "Insufficient cashier balance for this expense",
            },
            status: 422,
          };
        }
        cashierBalance -= payload.amount;
      }

      if (payload.source_of_fund === "QRIS") {
        if (qrisBalance < payload.amount) {
          return {
            error: {
              code: "insufficient_balance",
              message: "Insufficient QRIS balance for this expense",
            },
            status: 422,
          };
        }
        qrisBalance -= payload.amount;
      }

      this.expenses.set(id, expense);
      return { data: expense };
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

    if (pathname === "/api/admin/qris-balance" && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: {
            balance: String(store.qrisBalance),
            updated_at: new Date().toISOString(),
          },
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

    const expenseMatch = pathname.match(/\/api\/admin\/expenses\/([^/]+)$/);
    if (expenseMatch && method === "GET") {
      const expense = store.expenses.get(expenseMatch[1]);
      if (!expense) {
        return route.fulfill(json({ success: false }, 404));
      }
      return route.fulfill(json({ success: true, data: expense }));
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

async function testQrisOptionVisible(page) {
  await page.goto(`${WEB_BASE}/admin/expenses/new`, { waitUntil: "networkidle" });
  await page.getByTestId("expense-new-page").waitFor();

  const select = page.getByTestId("expense-source-of-fund-select");
  const options = await select.locator("option").allTextContents();
  if (!options.includes("QRIS Balance")) {
    record(
      "Expense form shows QRIS option",
      false,
      `Expected QRIS Balance option, got ${options.join(", ")}`,
    );
    return;
  }

  record(
    "Expense form shows QRIS option",
    true,
    "Source of Fund dropdown includes QRIS Balance",
  );
}

async function testQrisHintDisplaysBalance(page, store) {
  store.setQrisBalance(275_000);

  await page.goto(`${WEB_BASE}/admin/expenses/new`, { waitUntil: "networkidle" });
  await page.getByTestId("expense-source-of-fund-select").selectOption("QRIS");
  await page.getByTestId("expense-qris-balance-hint").waitFor();

  const hintText = await page.getByTestId("expense-qris-balance-hint").textContent();
  if (!hintText?.includes("Rp 275.000")) {
    record(
      "QRIS hint displays balance",
      false,
      `Expected formatted balance in hint, got ${hintText}`,
    );
    return;
  }

  record(
    "QRIS hint displays balance",
    true,
    "Hint shows formatted current QRIS balance from API",
  );
}

async function testCreateQrisFundedExpense(page, store) {
  store.setQrisBalance(200_000);
  const beforeQris = store.qrisBalance;
  const amount = 50_000;

  await page.goto(`${WEB_BASE}/admin/expenses/new`, { waitUntil: "networkidle" });
  await fillExpenseForm(page, {
    title: "QRIS supplies",
    amount,
    sourceOfFund: "QRIS",
  });

  const createResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/expenses") &&
      res.request().method() === "POST",
  );
  await page.getByTestId("expense-form-submit").click();
  const response = await createResponse;

  if (response.status() !== 201) {
    record(
      "Create QRIS-funded expense",
      false,
      `Expected 201, got ${response.status()}`,
    );
    return;
  }

  if (store.qrisBalance !== beforeQris - amount) {
    record(
      "Create QRIS-funded expense",
      false,
      `Expected QRIS balance ${beforeQris - amount}, got ${store.qrisBalance}`,
    );
    return;
  }

  await page.getByText("Expense created").waitFor();
  record(
    "Create QRIS-funded expense",
    true,
    "Expense created and QRIS balance decreased by expense amount",
  );
}

async function testInsufficientQrisBalanceError(page, store) {
  store.setQrisBalance(10_000);
  const expensesBefore = store.expenses.size;

  await page.goto(`${WEB_BASE}/admin/expenses/new`, { waitUntil: "networkidle" });
  await fillExpenseForm(page, {
    title: "Large QRIS purchase",
    amount: 50_000,
    sourceOfFund: "QRIS",
  });

  const createResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/expenses") &&
      res.request().method() === "POST",
  );
  await page.getByTestId("expense-form-submit").click();
  const response = await createResponse;

  if (response.status() !== 422) {
    record(
      "Insufficient balance error on create",
      false,
      `Expected 422, got ${response.status()}`,
    );
    return;
  }

  await page.getByTestId("expense-source-of-fund-error").waitFor();
  const errorText = await page
    .getByTestId("expense-source-of-fund-error")
    .textContent();

  if (!errorText?.toLowerCase().includes("insufficient")) {
    record(
      "Insufficient balance error on create",
      false,
      `Expected insufficient balance error, got ${errorText}`,
    );
    return;
  }

  if (store.expenses.size !== expensesBefore) {
    record(
      "Insufficient balance error on create",
      false,
      "Expense should not be created when QRIS balance is insufficient",
    );
    return;
  }

  record(
    "Insufficient balance error on create",
    true,
    "Form shows source_of_fund error and expense not created",
  );
}

async function testCashierExpenseRegression(page, store) {
  store.setCashierBalance(400_000);
  store.setQrisBalance(250_000);
  const beforeCashier = store.cashierBalance;
  const beforeQris = store.qrisBalance;
  const amount = 60_000;

  await page.goto(`${WEB_BASE}/admin/expenses/new`, { waitUntil: "networkidle" });
  await fillExpenseForm(page, {
    title: "Cashier petty cash",
    amount,
    sourceOfFund: "CASHIER",
  });

  const createResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/expenses") &&
      res.request().method() === "POST",
  );
  await page.getByTestId("expense-form-submit").click();
  const response = await createResponse;

  if (!response.ok()) {
    record(
      "Cashier expense regression",
      false,
      `Cashier expense create failed: ${response.status()}`,
    );
    return;
  }

  if (store.cashierBalance !== beforeCashier - amount) {
    record(
      "Cashier expense regression",
      false,
      `Cashier balance should decrease by ${amount}`,
    );
    return;
  }

  if (store.qrisBalance !== beforeQris) {
    record(
      "Cashier expense regression",
      false,
      `QRIS balance should remain ${beforeQris}, got ${store.qrisBalance}`,
    );
    return;
  }

  record(
    "Cashier expense regression",
    true,
    "Cashier expense deducts cashier balance only; QRIS balance unchanged",
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const store = createMockStore();

  await installApiMocks(page, store);
  await seedSession(context, page);

  try {
    await testQrisOptionVisible(page);
    await testQrisHintDisplaysBalance(page, store);
    await testCreateQrisFundedExpense(page, store);
    await testInsufficientQrisBalanceError(page, store);
    await testCashierExpenseRegression(page, store);

    const failed = results.filter(([, status]) => status === "FAIL");
    if (failed.length > 0) {
      console.error(`\n${failed.length} check(s) failed.`);
      process.exit(1);
    }

    console.log("\nAll POS-182-6 browser checks passed.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
