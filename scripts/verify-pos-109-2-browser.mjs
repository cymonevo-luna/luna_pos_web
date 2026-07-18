#!/usr/bin/env node
/**
 * Browser smoke for POS-109-2: unauthorized page shows required privilege context.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";

function makeJwt(claims) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url",
  );
  const body = Buffer.from(
    JSON.stringify({
      uid: "cashier-1",
      email: "cashier-test@cymonevo.com",
      roles: ["cashier"],
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

function cashierUser(features) {
  return {
    id: "cashier-1",
    email: "cashier-test@cymonevo.com",
    name: "Cashier Test",
    roles: ["cashier"],
    features,
    merchant_id: "merchant-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
  };
}

async function installApiMocks(page, features) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;

    if (pathname.endsWith("/api/v1/auth/login") && method === "POST") {
      const user = cashierUser(features);
      return route.fulfill(
        json({
          success: true,
          data: {
            user,
            merchant: { id: "merchant-1", name: "Test Merchant" },
            tokens: {
              access_token: makeJwt({
                features,
                uid: user.id,
              }),
              refresh_token: makeJwt({
                typ: "refresh",
                features,
                uid: user.id,
              }),
              expires_in: 3600,
              refresh_expires_in: 86400,
            },
          },
        }),
      );
    }

    if (pathname.endsWith("/api/v1/users/cashier-1") && method === "GET") {
      return route.fulfill(json({ success: true, data: cashierUser(features) }));
    }

    if (pathname.endsWith("/api/admin/menus") && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: { items: [], meta: { page: 1, per_page: 20, total: 0 } },
        }),
      );
    }

    if (pathname.endsWith("/api/v1/auth/refresh") && method === "POST") {
      const user = cashierUser(features);
      return route.fulfill(
        json({
          success: true,
          data: {
            tokens: {
              access_token: makeJwt({
                features,
                uid: user.id,
              }),
              refresh_token: makeJwt({
                typ: "refresh",
                features,
                uid: user.id,
              }),
              expires_in: 3600,
              refresh_expires_in: 86400,
            },
          },
        }),
      );
    }

    if (pathname.includes("/api/admin/categories") && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: { items: [], meta: { page: 1, per_page: 20, total: 0 } },
        }),
      );
    }

    return route.fulfill(json({ success: true, data: {} }));
  });
}

async function loginCashier(page, features) {
  await installApiMocks(page, features);
  await page.goto(`${WEB_BASE}/admin/login`);
  await page.locator("#email").fill("cashier-test@cymonevo.com");
  await page.locator("#password").fill("LunaTesting123!");
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForURL(
    (url) =>
      url.pathname.startsWith("/admin") && !url.pathname.startsWith("/admin/login"),
    { timeout: 15000 },
  );
}

async function withFreshPage(run) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    return await run(page);
  } finally {
    await browser.close();
  }
}

async function main() {
  const withoutMenus = [
    "pos.menu",
    "pos.transactions",
    "transactions.view",
  ];
  const results = [];

  const menusDenied = await withFreshPage(async (page) => {
    await loginCashier(page, withoutMenus);
    await page.goto(`${WEB_BASE}/admin/menus`);
    await page.waitForURL(/\/admin\/unauthorized/, { timeout: 15000 });
    return (
      (await page.getByText("menus.manage").count()) > 0 &&
      (await page.getByText("Menu").count()) > 0 &&
      page.url().includes("feature=menus.manage")
    );
  });
  results.push([
    "Unauthorized page shows required menus.manage",
    menusDenied ? "PASS" : "FAIL",
    "Denied /admin/menus shows menus.manage and Menu label",
  ]);

  const featuresVisible = await withFreshPage(async (page) => {
    await loginCashier(page, withoutMenus);
    await page.goto(`${WEB_BASE}/admin/menus`);
    await page.waitForURL(/\/admin\/unauthorized/, { timeout: 15000 });
    const privilegesSection = page.locator("section", {
      has: page.getByText("Your current privileges"),
    });
    return (
      (await privilegesSection.getByText("pos.menu").count()) > 0 &&
      (await privilegesSection.getByText("pos.transactions").count()) > 0 &&
      (await privilegesSection.getByText("menus.manage").count()) === 0
    );
  });
  results.push([
    "Unauthorized page shows current user features",
    featuresVisible ? "PASS" : "FAIL",
    "Lists pos.menu and pos.transactions without menus.manage",
  ]);

  const grantedOk = await withFreshPage(async (page) => {
    await loginCashier(page, [...withoutMenus, "menus.manage"]);
    await page.goto(`${WEB_BASE}/admin/menus`);
    await page.waitForURL(/\/admin\/menus/, { timeout: 15000 });
    return (
      !page.url().includes("/admin/unauthorized") &&
      (await page.getByRole("heading", { name: "Menus" }).count()) > 0
    );
  });
  results.push([
    "Granted user does not see unauthorized page",
    grantedOk ? "PASS" : "FAIL",
    "Cashier with menus.manage loads /admin/menus",
  ]);

  const categoriesDenied = await withFreshPage(async (page) => {
    await loginCashier(page, withoutMenus);
    await page.goto(`${WEB_BASE}/admin/categories`);
    await page.waitForURL(/\/admin\/unauthorized/, { timeout: 15000 });
    return (
      (await page.getByText("categories.manage").count()) > 0 &&
      page.url().includes("feature=categories.manage")
    );
  });
  results.push([
    "Other routes show their required privilege",
    categoriesDenied ? "PASS" : "FAIL",
    "Denied /admin/categories shows categories.manage",
  ]);

  console.log("POS-109-2 browser verification");
  for (const [name, status, note] of results) {
    console.log(`${status}: ${name} — ${note}`);
  }

  if (results.some(([, status]) => status === "FAIL")) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
