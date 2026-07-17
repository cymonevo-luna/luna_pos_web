#!/usr/bin/env node
/**
 * Browser verification for POS-79-5: expense create/edit forms with receipt upload.
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const MANAGER_EMAIL =
  process.env.TEST_MANAGER_EMAIL ?? "manager-test@cymonevo.com";
const OPERATIONAL_EMAIL =
  process.env.TEST_OPERATIONAL_EMAIL ?? "operation-test@cymonevo.com";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "LunaTesting123!";
const MOCK_API = !["0", "false", "no"].includes(
  String(process.env.MOCK_API ?? "1").toLowerCase(),
);

const MANAGER_USER_ID = "user-manager-verify-79-5";
const OPERATIONAL_USER_ID = "user-operational-verify-79-5";

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
  let nextId = 1;
  let receiptCounter = 1;

  return {
    expenses,
    createExpense(payload) {
      const id = `exp-verify-79-5-${nextId++}`;
      const expense = {
        id,
        title: payload.title,
        description: payload.description ?? null,
        amount: payload.amount,
        receipt_url: payload.receipt_url ?? null,
        created_by_user_id: payload.created_by_user_id ?? MANAGER_USER_ID,
        created_by_username: payload.created_by_username ?? "Manager User",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expenses.set(id, expense);
      return expense;
    },
    updateExpense(id, payload) {
      const existing = expenses.get(id);
      if (!existing) return null;
      const updated = {
        ...existing,
        title: payload.title,
        description: payload.description ?? null,
        amount: payload.amount,
        receipt_url:
          payload.receipt_url === ""
            ? null
            : (payload.receipt_url ?? existing.receipt_url),
        updated_at: new Date().toISOString(),
      };
      expenses.set(id, updated);
      return updated;
    },
    nextReceiptUrl() {
      const url = `https://example.com/uploads/receipt-verify-79-5-${receiptCounter++}.jpg`;
      return url;
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
      const expense = store.createExpense(payload);
      return route.fulfill(json({ success: true, data: expense }, 201));
    }

    const expenseMatch = pathname.match(/^\/api\/admin\/expenses\/([^/]+)$/);
    if (expenseMatch && method === "GET") {
      const expense = store.expenses.get(expenseMatch[1]);
      if (!expense) {
        return route.fulfill(json({ success: false }, 404));
      }
      return route.fulfill(json({ success: true, data: expense }));
    }

    if (expenseMatch && method === "PUT") {
      const payload = request.postDataJSON();
      const expense = store.updateExpense(expenseMatch[1], payload);
      if (!expense) {
        return route.fulfill(json({ success: false }, 404));
      }
      return route.fulfill(json({ success: true, data: expense }));
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

async function fillExpenseForm(page, { title, description, amount }) {
  await page.getByTestId("expense-title-input").fill(title);
  if (description != null) {
    await page.getByTestId("expense-description-input").fill(description);
  }
  await page.getByTestId("expense-amount-input").fill(String(amount));
}

async function submitCreateForm(page) {
  const createResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/expenses") &&
      res.request().method() === "POST" &&
      res.status() === 201,
  );
  await page.getByTestId("expense-form-submit").click();
  return createResponse;
}

async function runChecks(page, context, store) {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const jpegPath = join(scriptDir, "fixtures", "receipt-verify-79-3.jpg");
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

  // 1. Create expense without receipt
  await page.goto(`${WEB_BASE}/admin/expenses/new`, { waitUntil: "networkidle" });
  await page.getByTestId("expense-new-page").waitFor();
  await fillExpenseForm(page, {
    title: "Office supplies",
    description: "Printer paper",
    amount: 150_000,
  });
  await submitCreateForm(page);
  await page.waitForURL("**/admin/expenses");
  await page.getByTestId("expenses-page").waitFor();
  await page.getByText("Office supplies").waitFor();
  await page.getByText("Rp 150.000").waitFor();
  console.log("PASS: Create expense without receipt");

  // 5. Form validation blocks empty title / zero amount
  await page.goto(`${WEB_BASE}/admin/expenses/new`, { waitUntil: "networkidle" });
  let postCalls = 0;
  page.on("request", (req) => {
    if (
      req.url().includes("/api/admin/expenses") &&
      req.method() === "POST"
    ) {
      postCalls += 1;
    }
  });
  await fillExpenseForm(page, { title: "A", amount: 0 });
  await page.getByTestId("expense-form-submit").click();
  await page.getByText(/Title must be at least/).waitFor();
  await page.waitForTimeout(300);
  if (postCalls > 0) {
    throw new Error("Validation should block API call for short title");
  }
  await page.getByTestId("expense-title-input").fill("Valid title");
  await page.getByTestId("expense-amount-input").fill("0");
  await page.getByTestId("expense-form-submit").click();
  await page.getByText(/Amount must be at least/).waitFor();
  await page.waitForTimeout(300);
  if (postCalls > 0) {
    throw new Error("Validation should block API call for zero amount");
  }
  console.log("PASS: Form validation blocks empty title");

  // 2. Create expense with receipt upload
  await page.goto(`${WEB_BASE}/admin/expenses/new`, { waitUntil: "networkidle" });
  await fillExpenseForm(page, {
    title: "Travel expense",
    description: "Taxi fare",
    amount: 75_000,
  });
  const uploadResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/uploads/expense-receipt") &&
      res.request().method() === "POST" &&
      res.status() === 201,
  );
  await page.getByTestId("expense-receipt-file-input").setInputFiles(jpegPath);
  await uploadResponse;
  await page.getByTestId("expense-receipt-preview-image").waitFor();
  await submitCreateForm(page);
  await page.waitForURL("**/admin/expenses");
  await page.getByText("Travel expense").waitFor();
  await page.getByTestId("expense-receipt-link").first().waitFor();
  console.log("PASS: Create expense with receipt upload");

  const travelRow = [...store.expenses.values()].find(
    (expense) => expense.title === "Travel expense",
  );
  if (!travelRow?.receipt_url) {
    throw new Error("Expected travel expense to have receipt_url");
  }

  // 3. Edit expense updates fields
  await page.goto(`${WEB_BASE}/admin/expenses/${travelRow.id}/edit`, {
    waitUntil: "networkidle",
  });
  await page.getByTestId("expense-edit-page").waitFor();
  await page.getByTestId("expense-title-input").fill("Updated travel expense");
  await page.getByTestId("expense-amount-input").fill("80000");
  const updateResponse = page.waitForResponse(
    (res) =>
      res.url().includes(`/api/admin/expenses/${travelRow.id}`) &&
      res.request().method() === "PUT" &&
      res.status() === 200,
  );
  await page.getByTestId("expense-form-submit").click();
  await updateResponse;
  await page.waitForURL("**/admin/expenses");
  await page.getByText("Updated travel expense").waitFor();
  await page.getByText("Rp 80.000").waitFor();
  console.log("PASS: Edit expense updates fields");

  // 4. Replace receipt on edit
  await page.goto(`${WEB_BASE}/admin/expenses/${travelRow.id}/edit`, {
    waitUntil: "networkidle",
  });
  const oldReceiptUrl = store.expenses.get(travelRow.id)?.receipt_url;
  const replaceUpload = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/uploads/expense-receipt") &&
      res.request().method() === "POST" &&
      res.status() === 201,
  );
  await page.getByTestId("expense-receipt-file-input").setInputFiles(jpegPath);
  const replaceResponse = await replaceUpload;
  const replaceBody = await replaceResponse.json();
  const newReceiptUrl = replaceBody.data.url;
  const replaceUpdate = page.waitForResponse(
    (res) =>
      res.url().includes(`/api/admin/expenses/${travelRow.id}`) &&
      res.request().method() === "PUT" &&
      res.status() === 200,
  );
  await page.getByTestId("expense-form-submit").click();
  await replaceUpdate;
  await page.waitForURL("**/admin/expenses");
  const updated = store.expenses.get(travelRow.id);
  if (updated?.receipt_url !== newReceiptUrl) {
    throw new Error("Expected updated receipt_url after replace");
  }
  if (updated?.receipt_url === oldReceiptUrl) {
    throw new Error("Receipt URL should have changed after replace");
  }
  console.log("PASS: Replace receipt on edit");

  // 6. Operational user can create expense
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
  await fillExpenseForm(page, {
    title: "Operational expense",
    description: "Supplies",
    amount: 42_000,
  });
  await submitCreateForm(page);
  await page.waitForURL("**/admin/expenses");
  await page.getByText("Operational expense").waitFor();
  console.log("PASS: Operational user can create expense");
}

async function main() {
  console.log(
    `POS-79-5 browser verification (MOCK_API=${MOCK_API}, WEB_BASE=${WEB_BASE})`,
  );

  if (!MOCK_API) {
    console.log("Live API mode not implemented for POS-79-5; using mocks.");
  }

  const store = createMockStore();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await installApiMocks(page, store);
  await runChecks(page, context, store);

  await browser.close();
  console.log("All POS-79-5 browser checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
