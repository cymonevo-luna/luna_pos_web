#!/usr/bin/env node
/**
 * Browser verification for POS-142-4: cook privilege mapping and user creation.
 *
 * Live mode requires Next.js with NEXT_PUBLIC_API_URL matching API_BASE
 * (e.g. NEXT_PUBLIC_API_URL=http://localhost:8087 npm run dev).
 *
 * | Variable | Default | Purpose |
 * |---|---|---|
 * | WEB_BASE | http://localhost:3000 | Next.js app URL |
 * | NEXT_PUBLIC_API_URL | http://localhost:8087 | API base |
 * | TEST_ADMIN_EMAIL | admin-test@cymonevo.com | Admin login |
 * | TEST_ADMIN_PASSWORD | LunaTesting123! | Admin password |
 * | MOCK_API | 1 (mocked) | Set 0/false/no for live stack |
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "admin-test@cymonevo.com";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "LunaTesting123!";
const MOCK_API = !["0", "false", "no"].includes(
  String(process.env.MOCK_API ?? "1").toLowerCase(),
);

const ROLE_COLUMNS = ["Admin", "Manager", "Cashier", "Operational", "Cook"];
const COOK_EMAIL = `cook-e2e-${Date.now()}@integration.test`;

function makeJwt(claims = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url",
  );
  const body = Buffer.from(
    JSON.stringify({
      uid: "user-admin-verify-142-4",
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
    key: "production_requests.view",
    name: "Production Requests",
    description: "View production requests",
    category: "admin",
    sort_order: 180,
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
];

function defaultMappings() {
  return [
    {
      role: "admin",
      features: ["users.manage", "role_features.manage"],
    },
    { role: "manager", features: [] },
    { role: "cashier", features: [] },
    { role: "operational", features: [] },
    { role: "cook", features: [] },
  ];
}

async function installApiMocks(page, state) {
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
              id: "user-admin-verify-142-4",
              email: ADMIN_EMAIL,
              name: "Admin User",
              roles: ["admin"],
              features: ["users.manage", "role_features.manage"],
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

    if (pathname === "/api/admin/features" && method === "GET") {
      return route.fulfill(json({ success: true, data: features }));
    }

    if (pathname === "/api/admin/role-features" && method === "GET") {
      return route.fulfill(json({ success: true, data: state.mappings }));
    }

    if (pathname.startsWith("/api/admin/role-features/") && method === "PUT") {
      const role = pathname.split("/").pop();
      const payload = request.postDataJSON();
      state.mappings = state.mappings.map((entry) =>
        entry.role === role
          ? { role, features: payload.features ?? [] }
          : entry,
      );
      const updated = state.mappings.find((entry) => entry.role === role);
      return route.fulfill(json({ success: true, data: updated }));
    }

    if (pathname === "/api/admin/users" && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: state.users,
          meta: { page: 1, per_page: 10, total: state.users.length },
        }),
      );
    }

    if (pathname === "/api/admin/users" && method === "POST") {
      const payload = request.postDataJSON();
      const created = {
        id: `user-${Date.now()}`,
        email: payload.email,
        name: payload.name,
        roles: payload.roles,
        merchant_id: "merchant-1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      state.users.unshift(created);
      state.createdUserId = created.id;
      return route.fulfill(json({ success: true, data: created }, 201));
    }

    const userMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (userMatch && method === "GET") {
      const user =
        state.users.find((entry) => entry.id === userMatch[1]) ??
        state.users[0];
      return route.fulfill(json({ success: true, data: user }));
    }

    if (userMatch && method === "DELETE") {
      state.users = state.users.filter((entry) => entry.id !== userMatch[1]);
      return route.fulfill({ status: 204, body: "" });
    }

    if (pathname.includes("/api/v1/users/") && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: {
            id: "user-admin-verify-142-4",
            email: ADMIN_EMAIL,
            name: "Admin User",
            roles: ["admin"],
            features: ["users.manage", "role_features.manage"],
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

async function cleanupCookTestUsers(page) {
  if (MOCK_API) return;

  const token = await page.evaluate(() => localStorage.getItem("nt_access_token"));
  if (!token) return;

  const listRes = await fetch(
    `${API_BASE}/api/admin/users?search=cook-e2e-&per_page=100`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const listBody = await listRes.json();
  const users = listBody.data ?? [];

  for (const user of users) {
    if (!String(user.email).includes("cook-e2e-")) continue;
    await fetch(`${API_BASE}/api/admin/users/${user.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

async function login(page) {
  await page.goto(`${WEB_BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 20000 });
}

async function expectRoleFeatureColumns(page) {
  await page.goto(`${WEB_BASE}/admin/role-features`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector("text=Privilege Mapping", { timeout: 15000 });

  for (const column of ROLE_COLUMNS) {
    await page.getByRole("columnheader", { name: column }).waitFor();
  }

  console.log("PASS: Cook column visible alongside existing role columns");
}

async function expectCookPrivilegesPersist(page) {
  const checkbox = page.getByRole("checkbox", {
    name: "Production Requests for Cook",
    exact: true,
  });
  await checkbox.waitFor();
  const wasChecked = await checkbox.isChecked();
  await checkbox.click();

  const saveResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/role-features/cook") &&
      res.request().method() === "PUT" &&
      res.status() === 200,
  );
  const saveButtons = page.getByRole("columnheader", { name: "Cook" }).getByRole(
    "button",
    { name: "Save" },
  );
  await saveButtons.click();
  await saveResponse;
  await page.getByText("Cook privileges saved").waitFor();

  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#cook-production_requests\\.view").waitFor();
  if ((await checkbox.isChecked()) === wasChecked) {
    throw new Error("Cook privilege did not persist after reload");
  }

  console.log("PASS: Cook privileges save and persist after reload");

  await checkbox.click();
  const restoreResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/role-features/cook") &&
      res.request().method() === "PUT" &&
      res.status() === 200,
  );
  await saveButtons.click();
  await restoreResponse;
}

async function expectCookUserFlow(page) {
  await page.goto(`${WEB_BASE}/admin/users`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Create user" }).click();
  await page.getByLabel("Cook").waitFor();

  await page.getByLabel("Email").fill(COOK_EMAIL);
  await page.getByLabel("Name").fill("Cook E2E");
  await page.locator("#admin-user-password").fill("LunaTesting123!");
  await page.getByLabel("Cook").check();

  const createResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/users") &&
      res.request().method() === "POST" &&
      res.status() === 201,
  );
  const submitButtons = page.getByRole("button", { name: "Create user" });
  await submitButtons.last().click();
  const response = await createResponse;
  const body = await response.json();
  const userId = body?.data?.id;

  const row = page.locator("tr", { hasText: COOK_EMAIL });
  await row.waitFor();
  await row.locator("span", { hasText: "Cook" }).waitFor();
  console.log("PASS: Created cook-only user with Cook badge");

  if (userId) {
    await page.goto(`${WEB_BASE}/admin/users/${userId}`, {
      waitUntil: "networkidle",
    });
    await page.locator("span", { hasText: "Cook" }).first().waitFor();
    console.log("PASS: Cook user detail shows Cook role badge");
  }

  await page.goto(`${WEB_BASE}/admin/users`, { waitUntil: "networkidle" });
  const cookRow = page.locator("tr", { hasText: COOK_EMAIL });
  await cookRow.getByLabel("Remove user").click();
  await page
    .locator(".fixed")
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await cookRow.waitFor({ state: "hidden" });
  console.log("PASS: Cleaned up cook test user");
}

async function expectExistingRoleBadges(page) {
  await page.goto(`${WEB_BASE}/admin/users`, { waitUntil: "networkidle" });
  for (const role of ["Admin", "Manager", "Cashier", "Operational"]) {
    const badge = page.getByText(role, { exact: true });
    if ((await badge.count()) === 0) {
      throw new Error(`Expected existing role badge "${role}" in users list`);
    }
  }
  console.log("PASS: Existing role badges still render on users page");
}

async function main() {
  console.log(
    `POS-142-4 browser verification (MOCK_API=${MOCK_API}, WEB_BASE=${WEB_BASE})`,
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const state = {
    mappings: defaultMappings(),
    users: [
      {
        id: "user-admin",
        email: ADMIN_EMAIL,
        name: "Admin User",
        roles: ["admin"],
        merchant_id: "merchant-1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "user-manager",
        email: "manager-test@cymonevo.com",
        name: "Manager User",
        roles: ["manager"],
        merchant_id: "merchant-1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "user-cashier",
        email: "cashier-test@cymonevo.com",
        name: "Cashier User",
        roles: ["cashier"],
        merchant_id: "merchant-1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "user-operational",
        email: "operation-test@cymonevo.com",
        name: "Operational User",
        roles: ["operational"],
        merchant_id: "merchant-1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
    createdUserId: null,
  };

  if (MOCK_API) {
    await installApiMocks(page, state);
  }

  await login(page);
  await cleanupCookTestUsers(page);
  await expectRoleFeatureColumns(page);
  await expectCookPrivilegesPersist(page);
  await expectCookUserFlow(page);
  await expectExistingRoleBadges(page);

  await browser.close();
  console.log("\nAll POS-142-4 browser checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
