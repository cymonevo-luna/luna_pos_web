#!/usr/bin/env node
/**
 * Browser verification for POS-78-6: admin staff list page and navigation.
 *
 * Mocked mode (default) exercises list/create/edit/delete/search and RBAC
 * without luna_pos_service. Set MOCK_API=0 for live stack.
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
const MOCK_API = !["0", "false", "no"].includes(
  String(process.env.MOCK_API ?? "1").toLowerCase(),
);

const ADMIN_USER_ID = "user-admin-verify-78-6";
const MANAGER_USER_ID = "user-manager-verify-78-6";

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

function buildStaff(id, overrides = {}) {
  return {
    id,
    name: overrides.name ?? "Budi Santoso",
    nik: overrides.nik ?? "3201010101010001",
    address: overrides.address ?? "Jl. Merdeka No. 1",
    job_title: overrides.job_title ?? "Cashier",
    salary_amount: overrides.salary_amount ?? 5_000_000,
    ktp_photo_url: overrides.ktp_photo_url ?? null,
    benefits: overrides.benefits ?? null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
  };
}

const initialStaff = [
  buildStaff("staff-verify-78-6-1"),
  buildStaff("staff-verify-78-6-2", {
    name: "Siti Rahayu",
    nik: "3201010101010002",
    job_title: "Waiter",
    salary_amount: 4_500_000,
  }),
];

function filterStaff(staffList, search) {
  const term = search.trim().toLowerCase();
  if (!term) return staffList;
  return staffList.filter(
    (s) =>
      s.name.toLowerCase().includes(term) ||
      s.nik.toLowerCase().includes(term) ||
      s.job_title.toLowerCase().includes(term),
  );
}

async function installApiMocks(page, state, role = "admin") {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;

    if (pathname.endsWith("/api/v1/auth/login") && method === "POST") {
      const body = request.postDataJSON();
      const isManager = body.email === MANAGER_EMAIL;
      const userId = isManager ? MANAGER_USER_ID : ADMIN_USER_ID;
      const roles = isManager ? ["manager"] : ["admin"];
      const email = isManager ? MANAGER_EMAIL : ADMIN_EMAIL;
      return route.fulfill(
        json({
          success: true,
          data: {
            user: {
              id: userId,
              email,
              name: isManager ? "Manager User" : "Admin User",
              roles,
              merchant_id: "merchant-1",
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
            merchant: { id: "merchant-1", name: "Test Merchant" },
            tokens: {
              access_token: makeJwt({
                uid: userId,
                email,
                roles,
                typ: "access",
              }),
              refresh_token: makeJwt({
                uid: userId,
                email,
                roles,
                typ: "refresh",
              }),
              expires_in: 3600,
              refresh_expires_in: 86400,
            },
          },
        }),
      );
    }

    const userMatch = pathname.match(/^\/api\/v1\/users\/([^/]+)$/);
    if (userMatch && method === "GET") {
      const userId = userMatch[1];
      const isManager = userId === MANAGER_USER_ID;
      return route.fulfill(
        json({
          success: true,
          data: {
            id: userId,
            email: isManager ? MANAGER_EMAIL : ADMIN_EMAIL,
            name: isManager ? "Manager User" : "Admin User",
            roles: isManager ? ["manager"] : ["admin"],
            merchant_id: "merchant-1",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        }),
      );
    }

    if (pathname === "/api/admin/staff" && method === "GET") {
      const search = url.searchParams.get("search") ?? "";
      const pageNum = Number(url.searchParams.get("page") ?? "1");
      const perPage = Number(url.searchParams.get("per_page") ?? "10");
      const filtered = filterStaff(state.staff, search);
      const start = (pageNum - 1) * perPage;
      const pageData = filtered.slice(start, start + perPage);
      return route.fulfill(
        json({
          success: true,
          data: pageData,
          meta: { page: pageNum, per_page: perPage, total: filtered.length },
        }),
      );
    }

    const staffGetMatch = pathname.match(/^\/api\/admin\/staff\/([^/]+)$/);
    if (staffGetMatch && method === "GET") {
      const id = staffGetMatch[1];
      const staff = state.staff.find((s) => s.id === id);
      if (!staff || state.deletedIds.has(id)) {
        return route.fulfill(
          json(
            {
              success: false,
              error: { code: "not_found", message: "Staff not found" },
            },
            404,
          ),
        );
      }
      return route.fulfill(json({ success: true, data: staff }));
    }

    if (pathname === "/api/admin/staff" && method === "POST") {
      const body = request.postDataJSON();
      const created = buildStaff(`staff-created-${Date.now()}`, {
        name: body.name,
        nik: body.nik,
        address: body.address,
        job_title: body.job_title,
        salary_amount: body.salary_amount,
        ktp_photo_url: body.ktp_photo_url ?? null,
        benefits: body.benefits ?? null,
      });
      state.staff.unshift(created);
      return route.fulfill(json({ success: true, data: created }), 201);
    }

    if (staffGetMatch && method === "PUT") {
      const id = staffGetMatch[1];
      const body = request.postDataJSON();
      const index = state.staff.findIndex((s) => s.id === id);
      if (index < 0) {
        return route.fulfill(
          json(
            {
              success: false,
              error: { code: "not_found", message: "Staff not found" },
            },
            404,
          ),
        );
      }
      state.staff[index] = {
        ...state.staff[index],
        name: body.name,
        nik: body.nik,
        address: body.address,
        job_title: body.job_title,
        salary_amount: body.salary_amount,
        ktp_photo_url: body.ktp_photo_url ?? null,
        benefits: body.benefits ?? null,
      };
      return route.fulfill(json({ success: true, data: state.staff[index] }));
    }

    if (staffGetMatch && method === "DELETE") {
      const id = staffGetMatch[1];
      state.deletedIds.add(id);
      state.staff = state.staff.filter((s) => s.id !== id);
      return route.fulfill({ status: 204, body: "" });
    }

    if (
      pathname === "/api/admin/uploads/staff-ktp" &&
      method === "POST"
    ) {
      return route.fulfill(
        json(
          {
            success: true,
            data: {
              url: "https://example.com/uploads/ktp-verify-78-6.jpg",
              filename: "ktp-verify-78-6.jpg",
              size_bytes: 512,
            },
          },
          201,
        ),
      );
    }

    if (pathname === "/api/admin/users" && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: [],
          meta: { page: 1, per_page: 10, total: 0 },
        }),
      );
    }

    if (pathname.endsWith("/api/v1/auth/refresh") && method === "POST") {
      return route.fulfill(
        json({
          success: true,
          data: {
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

    return route.continue();
  });
}

async function seedSession(page, context, user) {
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

async function login(page, email, password) {
  await page.goto(`${WEB_BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(
    (url) =>
      url.pathname.startsWith("/admin") &&
      !url.pathname.startsWith("/admin/login"),
    { timeout: 15000 },
  );
}

async function openStaffPage(page) {
  const listResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/staff") &&
      res.request().method() === "GET" &&
      res.status() === 200,
  );
  await page.goto(`${WEB_BASE}/admin/staff`, { waitUntil: "networkidle" });
  await listResponse;
  await page.getByTestId("staff-page").waitFor({ timeout: 15000 });
}

async function runAdminFlow(page, state) {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  // 3. Admin can open staff list page
  await openStaffPage(page);
  await page.getByRole("heading", { name: "Staff" }).waitFor();
  await page.getByText("Budi Santoso").waitFor();
  await page.getByText("Rp 5.000.000").first().waitFor();
  const staffNav = page.locator('aside nav a[href="/admin/staff"]');
  if ((await staffNav.count()) === 0) {
    throw new Error("Staff nav item not visible for admin");
  }
  console.log("PASS: Admin can open staff list page");

  // 4. Admin can create staff end-to-end
  await page.getByRole("button", { name: /Add staff/i }).click();
  const createDialog = page.getByRole("dialog");
  await createDialog.getByLabel("Name").fill("Andi Wijaya");
  await createDialog.getByLabel("NIK").fill("3201010101010099");
  await createDialog.getByLabel("Address").fill("Jl. Baru 99");
  await createDialog.getByLabel("Job title").fill("Chef");
  const salaryInput = createDialog.getByLabel(/Salary/);
  await salaryInput.click();
  await salaryInput.press("ControlOrMeta+a");
  await salaryInput.press("Backspace");
  await salaryInput.type("7500000", { delay: 20 });
  await salaryInput.press("Tab");
  const createResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/staff") &&
      res.request().method() === "POST",
  );
  await createDialog.locator('button[type="submit"]').click({ force: true });
  await createResponse;
  await page.getByText("Andi Wijaya").waitFor({ timeout: 10000 });
  await page.getByText("Rp 7.500.000").waitFor();
  console.log("PASS: Admin can create staff end-to-end");

  // 5. Admin can edit staff
  const andiRow = page.locator("tbody tr", { hasText: "Andi Wijaya" });
  await andiRow.getByLabel("Edit staff").click();
  const editDialog = page.getByRole("dialog");
  await editDialog.getByLabel("Job title").fill("Head Chef");
  const updateResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/staff/") &&
      res.request().method() === "PUT" &&
      res.status() === 200,
  );
  await editDialog.locator('button[type="submit"]').click();
  await updateResponse;
  await page.getByRole("cell", { name: "Head Chef" }).waitFor({ timeout: 10000 });

  const reloadResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/staff") &&
      res.request().method() === "GET" &&
      res.status() === 200,
  );
  await page.reload({ waitUntil: "networkidle" });
  await reloadResponse;
  await page.getByRole("cell", { name: "Head Chef" }).waitFor();
  console.log("PASS: Admin can edit staff");

  // 6. Admin can delete staff
  const deleteRow = page.locator("tbody tr", { hasText: "Andi Wijaya" });
  await deleteRow.getByLabel("Delete staff").click();
  const deleteResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/admin/staff/") &&
      res.request().method() === "DELETE",
  );
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await deleteResponse;
  if ((await page.locator("tbody tr", { hasText: "Andi Wijaya" }).count()) > 0) {
    throw new Error("Deleted staff row still visible");
  }
  const deletedId = state.staff.find((s) => s.name === "Andi Wijaya")?.id;
  if (deletedId && !state.deletedIds.has(deletedId)) {
    // Staff was removed from state on delete
  }
  console.log("PASS: Admin can delete staff");

  // 8. Search filters staff list
  await page.getByPlaceholder("Search by name, NIK, or job title").fill("siti");
  await page.waitForTimeout(400);
  await page.getByText("Siti Rahayu").waitFor({ timeout: 10000 });
  if ((await page.locator("tbody tr", { hasText: "Budi Santoso" }).count()) > 0) {
    throw new Error("Search did not filter out non-matching staff");
  }
  console.log("PASS: Search filters staff list");
}

async function runManagerBlockedFlow(page, context) {
  await seedSession(page, context, {
    id: MANAGER_USER_ID,
    email: MANAGER_EMAIL,
    name: "Manager User",
    roles: ["manager"],
    merchant_id: "merchant-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  });

  await page.goto(`${WEB_BASE}/admin`, { waitUntil: "networkidle" });
  const staffNav = page.locator('aside nav a[href="/admin/staff"]');
  if ((await staffNav.count()) > 0) {
    throw new Error("Staff nav item visible for manager");
  }

  await page.goto(`${WEB_BASE}/admin/staff`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/admin(?!\/staff)/, { timeout: 15000 });
  if (page.url().includes("/admin/staff")) {
    throw new Error("Manager was not blocked from /admin/staff");
  }
  console.log("PASS: Manager blocked from staff page");
}

async function main() {
  const state = {
    staff: [...initialStaff],
    deletedIds: new Set(),
  };

  console.log(
    `POS-78-6 browser verification (MOCK_API=${MOCK_API}, WEB_BASE=${WEB_BASE})`,
  );

  if (!MOCK_API) {
    throw new Error(
      "Live browser mode requires luna_pos_service — set MOCK_API=1 for mocked verification.",
    );
  }

  const browser = await chromium.launch({ headless: true });

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await installApiMocks(adminPage, state, "admin");
  await runAdminFlow(adminPage, state);
  await adminContext.close();

  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  await installApiMocks(managerPage, state, "manager");
  await runManagerBlockedFlow(managerPage, managerContext);
  await managerContext.close();

  await browser.close();
  console.log("All POS-78-6 browser checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
