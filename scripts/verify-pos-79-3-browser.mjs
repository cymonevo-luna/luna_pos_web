#!/usr/bin/env node
/**
 * Browser verification for POS-79-3: expense API hooks and receipt upload.
 *
 * Mocked mode (default) exercises useExpenses and useUploadExpenseReceipt without
 * luna_pos_service. Set MOCK_API=0 to hit a live API.
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const MANAGER_EMAIL =
  process.env.TEST_MANAGER_EMAIL ?? "manager-test@cymonevo.com";
const MANAGER_PASSWORD =
  process.env.TEST_MANAGER_PASSWORD ?? "LunaTesting123!";
const MOCK_API = !["0", "false", "no"].includes(
  String(process.env.MOCK_API ?? "1").toLowerCase(),
);

const MANAGER_USER_ID = "user-manager-verify-79-3";

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

const sampleExpenses = [
  {
    id: "exp-verify-79-3",
    title: "POS-79-3 Verify Expense",
    description: "Browser verification expense",
    amount: 125000,
    receipt_url: null,
    created_by_user_id: MANAGER_USER_ID,
    created_by_username: "Manager User",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

async function installApiMocks(page) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;

    if (pathname.endsWith("/api/v1/auth/login") && method === "POST") {
      return route.fulfill(
        json({
          success: true,
          data: {
            user: {
              id: MANAGER_USER_ID,
              email: MANAGER_EMAIL,
              name: "Manager User",
              roles: ["manager"],
              merchant_id: "merchant-1",
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
            merchant: { id: "merchant-1", name: "Test Merchant" },
            tokens: {
              access_token: makeJwt({ typ: "access" }),
              refresh_token: makeJwt({ typ: "refresh" }),
              expires_in: 3600,
              refresh_expires_in: 86400,
            },
          },
        }),
      );
    }

    if (pathname.includes(`/api/v1/users/${MANAGER_USER_ID}`) && method === "GET") {
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

    if (pathname === "/api/admin/expenses" && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: sampleExpenses,
          meta: { page: 1, per_page: 10, total: sampleExpenses.length },
        }),
      );
    }

    if (
      pathname === "/api/admin/uploads/expense-receipt" &&
      method === "POST"
    ) {
      const contentType = request.headers()["content-type"] ?? "";
      if (!contentType.includes("multipart/form-data")) {
        return route.fulfill(
          json(
            {
              success: false,
              error: {
                code: "invalid_content_type",
                message: "Expected multipart/form-data",
              },
            },
            400,
          ),
        );
      }

      return route.fulfill(
        json(
          {
            success: true,
            data: {
              url: "https://example.com/uploads/receipt-verify-79-3.jpg",
              filename: "receipt-verify-79-3.jpg",
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

async function seedManagerSession(context, page) {
  const accessToken = makeJwt({ typ: "access" });
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

async function runMockedFlow(page, context) {
  await installApiMocks(page);
  await seedManagerSession(context, page);

  const listResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/expenses") &&
      res.request().method() === "GET" &&
      res.status() === 200,
  );

  await page.goto(`${WEB_BASE}/admin/expenses/dev`, {
    waitUntil: "networkidle",
  });
  await listResponse;

  await page.getByTestId("expenses-dev-page").waitFor({ timeout: 15000 });
  await page.getByTestId("expenses-loaded").waitFor({ timeout: 15000 });
  await page.getByTestId("expense-item-exp-verify-79-3").waitFor();
  await page.getByText("POS-79-3 Verify Expense").waitFor();
  console.log("PASS: List hook fetches expenses in browser");

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const jpegPath = join(scriptDir, "fixtures", "receipt-verify-79-3.jpg");
  const uploadResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/uploads/expense-receipt") &&
      res.request().method() === "POST" &&
      res.status() === 201,
  );

  await page.getByTestId("expense-receipt-input").setInputFiles(jpegPath);
  const response = await uploadResponse;
  const contentType = response.request().headers()["content-type"] ?? "";
  if (!contentType.includes("multipart/form-data")) {
    throw new Error(
      `Expected multipart/form-data upload, got Content-Type: ${contentType}`,
    );
  }

  await page.getByTestId("upload-result").waitFor({ timeout: 15000 });
  await page.getByText("https://example.com/uploads/receipt-verify-79-3.jpg").waitFor();
  console.log("PASS: Upload hook sends multipart receipt");
}

async function main() {
  console.log(
    `POS-79-3 browser verification (MOCK_API=${MOCK_API}, WEB_BASE=${WEB_BASE})`,
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  if (MOCK_API) {
    await runMockedFlow(page, context);
  } else {
    await seedManagerSession(context, page);
    const listResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/admin/expenses") &&
        res.request().method() === "GET",
    );
    await page.goto(`${WEB_BASE}/admin/expenses/dev`, {
      waitUntil: "networkidle",
    });
    await listResponse;
    await page.getByTestId("expenses-dev-page").waitFor({ timeout: 15000 });
    console.log("PASS: List hook fetches expenses in browser (live API)");

    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const jpegPath = join(scriptDir, "fixtures", "receipt-verify-79-3.jpg");
    const uploadResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/admin/uploads/expense-receipt") &&
        res.request().method() === "POST",
    );
    await page.getByTestId("expense-receipt-input").setInputFiles(jpegPath);
    const response = await uploadResponse;
    if (response.status() !== 201) {
      throw new Error(`Upload failed with status ${response.status()}`);
    }
    const body = await response.json();
    if (!body?.data?.url) {
      throw new Error("Upload response missing data.url");
    }
    console.log("PASS: Upload hook sends multipart receipt (live API)");
  }

  await browser.close();
  console.log("All POS-79-3 browser checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
