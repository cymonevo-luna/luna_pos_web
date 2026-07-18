#!/usr/bin/env node
/**
 * Browser smoke for POS-89-5: admin privilege mapping dashboard.
 * Mocks role-features API when NEXT_PUBLIC_API_URL is not reachable.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "admin-test@cymonevo.com";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "LunaTesting123!";
const MANAGER_EMAIL =
  process.env.TEST_MANAGER_EMAIL ?? "manager-test@cymonevo.com";
const MANAGER_PASSWORD =
  process.env.TEST_MANAGER_PASSWORD ?? "LunaTesting123!";

function makeJwt(claims) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url",
  );
  const body = Buffer.from(
    JSON.stringify({
      uid: "user-admin",
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

const features = [
  {
    key: "cogs",
    name: "COGS",
    description: "View and manage cost of goods sold",
    category: "admin",
    sort_order: 10,
  },
  {
    key: "users.manage",
    name: "User management",
    category: "admin",
    sort_order: 20,
  },
  {
    key: "role_features.manage",
    name: "Privilege mapping",
    category: "admin",
    sort_order: 30,
  },
  {
    key: "pos.checkout",
    name: "POS Checkout",
    category: "pos",
    sort_order: 40,
  },
];

function defaultMappings() {
  return [
    { role: "admin", features: ["cogs", "users.manage", "role_features.manage"] },
    { role: "manager", features: ["cogs"] },
    { role: "cashier", features: ["pos.checkout"] },
    { role: "operational", features: [] },
  ];
}

async function installApiMocks(page, state) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;

    if (pathname.endsWith("/api/v1/auth/login") && method === "POST") {
      const payload = request.postDataJSON();
      const email = payload.email;
      let roles = ["admin"];
      let uid = "user-admin";
      if (email === MANAGER_EMAIL) {
        roles = ["manager"];
        uid = "user-mgr";
      }
      state.currentRole = roles[0];
      return route.fulfill(
        json({
          success: true,
          data: {
            user: {
              id: uid,
              email,
              name: "Test User",
              roles,
              merchant_id: "merchant-1",
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
            merchant: { id: "merchant-1", name: "Test Merchant" },
            tokens: {
              access_token: makeJwt({ typ: "access", roles, uid, email }),
              refresh_token: makeJwt({ typ: "refresh", roles, uid, email }),
              expires_in: 3600,
              refresh_expires_in: 86400,
            },
          },
        }),
      );
    }

    if (pathname.includes("/api/v1/users/") && method === "GET") {
      const roles = state.currentRole === "manager" ? ["manager"] : ["admin"];
      const email = state.currentRole === "manager" ? MANAGER_EMAIL : ADMIN_EMAIL;
      const uid = state.currentRole === "manager" ? "user-mgr" : "user-admin";
      return route.fulfill(
        json({
          success: true,
          data: {
            id: uid,
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

    if (pathname === "/api/admin/features" && method === "GET") {
      return route.fulfill(json({ success: true, data: state.features }));
    }

    if (pathname === "/api/admin/role-features" && method === "GET") {
      return route.fulfill(json({ success: true, data: state.mappings }));
    }

    if (pathname.startsWith("/api/admin/role-features/") && method === "PUT") {
      const role = pathname.split("/").pop();
      const payload = request.postDataJSON();
      if (role === "admin" && !payload.features.includes("role_features.manage")) {
        return route.fulfill(
          json(
            {
              success: false,
              error: {
                code: "conflict",
                message:
                  "Cannot remove role_features.manage from your own admin role",
              },
            },
            409,
          ),
        );
      }
      const mapping = { role, features: payload.features };
      state.mappings = state.mappings.map((entry) =>
        entry.role === role ? mapping : entry,
      );
      return route.fulfill(json({ success: true, data: mapping }));
    }

    return route.continue();
  });
}

async function login(page, email, password) {
  await page.goto(`${WEB_BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(
    (url) =>
      url.pathname.startsWith("/admin") &&
      !url.pathname.includes("/admin/login"),
    { timeout: 15000 },
  );
}

async function main() {
  const state = {
    currentRole: "admin",
    features: [...features],
    mappings: defaultMappings(),
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await installApiMocks(page, state);

  // 1. Admin can open privilege mapping page
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`${WEB_BASE}/admin/role-features`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("heading", { name: "Privilege Mapping" }).waitFor();
  await page.getByRole("cell", { name: "Admin dashboard" }).waitFor();
  await page.getByRole("cell", { name: "POS mobile app" }).waitFor();
  await page.getByText("COGS", { exact: true }).waitFor();
  console.log("PASS: Admin can open privilege mapping page");

  // 2. Admin can update manager features
  const managerCogs = page.getByRole("checkbox", { name: "COGS for Manager" });
  await managerCogs.waitFor();
  if (await managerCogs.isChecked()) {
    await managerCogs.click();
  }
  const saveButtons = page.getByRole("button", { name: "Save" });
  await saveButtons.nth(1).click();
  await page.getByText("Manager privileges saved").waitFor({ timeout: 10000 });
  await page.reload({ waitUntil: "networkidle" });
  await expectUnchecked(page, "COGS for Manager");
  console.log("PASS: Admin can update manager features");

  // 4. New registry feature appears automatically
  state.features = [
    ...features,
    {
      key: "registry.synced",
      name: "Registry Synced Feature",
      category: "admin",
      sort_order: 50,
    },
  ];
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Registry Synced Feature").waitFor();
  console.log("PASS: New registry feature appears automatically");

  // 5. API error surfaced in UI
  const adminPrivilege = page.getByRole("checkbox", {
    name: "Privilege mapping for Admin",
  });
  if (await adminPrivilege.isChecked()) {
    await adminPrivilege.click();
  }
  await saveButtons.first().click();
  await page
    .getByText("Cannot remove role_features.manage from your own admin role")
    .waitFor({ timeout: 10000 });
  await expectChecked(page, "Privilege mapping for Admin");
  console.log("PASS: API error surfaced in UI");

  // 3. Manager cannot access page
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  state.currentRole = "manager";
  await login(page, MANAGER_EMAIL, MANAGER_PASSWORD);
  await page.goto(`${WEB_BASE}/admin/role-features`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1000);
  const url = page.url();
  const blocked =
    url.includes("/admin/unauthorized") ||
    !url.includes("/admin/role-features") ||
    (await page.getByRole("heading", { name: "Privilege Mapping" }).count()) ===
      0;
  if (!blocked) {
    throw new Error(`Manager was not blocked from role-features page: ${url}`);
  }
  console.log("PASS: Manager cannot access page");

  await browser.close();
}

async function expectUnchecked(page, name) {
  const checkbox = page.getByRole("checkbox", { name });
  await checkbox.waitFor();
  if (await checkbox.isChecked()) {
    throw new Error(`Expected ${name} to be unchecked after reload`);
  }
}

async function expectChecked(page, name) {
  const checkbox = page.getByRole("checkbox", { name });
  await checkbox.waitFor();
  if (!(await checkbox.isChecked())) {
    throw new Error(`Expected ${name} to remain checked after API error`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
