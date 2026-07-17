#!/usr/bin/env node
/**
 * Browser smoke for POS-85-3: order options settings CRUD and reorder.
 * Mocks admin order-options API when NEXT_PUBLIC_API_URL is not reachable.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const MANAGER_EMAIL =
  process.env.TEST_MANAGER_EMAIL ?? "manager-test@cymonevo.com";
const MANAGER_PASSWORD =
  process.env.TEST_MANAGER_PASSWORD ?? "LunaTesting123!";
const OPERATIONAL_EMAIL =
  process.env.TEST_OPERATIONAL_EMAIL ?? "operation-test@cymonevo.com";
const OPERATIONAL_PASSWORD =
  process.env.TEST_OPERATIONAL_PASSWORD ?? "LunaTesting123!";

function makeJwt(claims) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url",
  );
  const body = Buffer.from(
    JSON.stringify({
      uid: "user-mgr",
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

function withPriorities(options) {
  return options.map((option, index) => ({
    ...option,
    priority: options.length - index,
  }));
}

function buildOption(id, name, ingredientCount = 0) {
  return {
    id,
    name,
    ingredient_count: ingredientCount,
    created_at: "2026-03-01T08:00:00Z",
    updated_at: "2026-03-01T08:00:00Z",
  };
}

async function installApiMocks(page, state) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;
    const role = state.currentRole ?? "manager";

    if (pathname.endsWith("/api/v1/auth/login") && method === "POST") {
      const payload = request.postDataJSON();
      const email = payload.email;
      let roles = ["manager"];
      let uid = "user-mgr";
      if (email === OPERATIONAL_EMAIL) {
        roles = ["operational"];
        uid = "user-op";
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
            merchant: {
              id: "merchant-1",
              name: "Test Merchant",
            },
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
      const roles =
        state.currentRole === "operational" ? ["operational"] : ["manager"];
      const email =
        state.currentRole === "operational"
          ? OPERATIONAL_EMAIL
          : MANAGER_EMAIL;
      const uid = state.currentRole === "operational" ? "user-op" : "user-mgr";
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

    if (pathname.startsWith("/api/admin/order-options")) {
      if (role !== "manager") {
        return route.fulfill(
          json(
            {
              success: false,
              error: { code: "forbidden", message: "Forbidden" },
            },
            403,
          ),
        );
      }

      if (method === "GET" && pathname === "/api/admin/order-options") {
        const search = url.searchParams.get("search")?.toLowerCase() ?? "";
        let options = withPriorities([...state.options]);
        if (search) {
          options = options.filter((option) =>
            option.name.toLowerCase().includes(search),
          );
        }
        return route.fulfill(
          json({
            success: true,
            data: options,
            meta: {
              page: 1,
              per_page: 100,
              total: options.length,
            },
          }),
        );
      }

      const detailMatch = pathname.match(/^\/api\/admin\/order-options\/([^/]+)$/);
      if (method === "GET" && detailMatch) {
        const option = state.options.find((item) => item.id === detailMatch[1]);
        if (!option) {
          return route.fulfill(
            json(
              {
                success: false,
                error: { code: "not_found", message: "Not found" },
              },
              404,
            ),
          );
        }
        return route.fulfill(json({ success: true, data: option }));
      }

      if (method === "POST" && pathname === "/api/admin/order-options") {
        const payload = request.postDataJSON();
        const name = payload.name?.trim();
        if (
          state.options.some(
            (option) => option.name.toLowerCase() === name.toLowerCase(),
          )
        ) {
          return route.fulfill(
            json(
              {
                success: false,
                error: {
                  code: "conflict",
                  message: "Order option name already exists",
                },
              },
              409,
            ),
          );
        }
        const created = buildOption(`opt-${Date.now()}`, name);
        state.options.push(created);
        return route.fulfill(
          json({ success: true, data: withPriorities(state.options)[0] }, 201),
        );
      }

      if (method === "PUT" && pathname === "/api/admin/order-options/reorder") {
        const payload = request.postDataJSON();
        const ids = payload.order_option_ids ?? [];
        const reordered = ids
          .map((id) => state.options.find((option) => option.id === id))
          .filter(Boolean);
        state.options = reordered;
        return route.fulfill(
          json({ success: true, data: withPriorities(state.options) }),
        );
      }

      if (method === "PUT" && detailMatch) {
        const payload = request.postDataJSON();
        const name = payload.name?.trim();
        const existing = state.options.find((item) => item.id === detailMatch[1]);
        if (!existing) {
          return route.fulfill(
            json(
              {
                success: false,
                error: { code: "not_found", message: "Not found" },
              },
              404,
            ),
          );
        }
        if (
          state.options.some(
            (option) =>
              option.id !== existing.id &&
              option.name.toLowerCase() === name.toLowerCase(),
          )
        ) {
          return route.fulfill(
            json(
              {
                success: false,
                error: {
                  code: "conflict",
                  message: "Order option name already exists",
                },
              },
              409,
            ),
          );
        }
        existing.name = name;
        return route.fulfill(json({ success: true, data: existing }));
      }

      if (method === "DELETE" && detailMatch) {
        const index = state.options.findIndex(
          (item) => item.id === detailMatch[1],
        );
        if (index === -1) {
          return route.fulfill(
            json(
              {
                success: false,
                error: { code: "not_found", message: "Not found" },
              },
              404,
            ),
          );
        }
        if (state.options[index].name === "In Use") {
          return route.fulfill(
            json(
              {
                success: false,
                error: {
                  code: "conflict",
                  message:
                    "Cannot delete order option referenced by transactions",
                },
              },
              409,
            ),
          );
        }
        state.options.splice(index, 1);
        return route.fulfill({ status: 204, body: "" });
      }
    }

    return route.continue();
  });
}

async function loginManager(page) {
  await page.goto(`${WEB_BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', MANAGER_EMAIL);
  await page.fill('input[type="password"]', MANAGER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 15000 });
}

async function loginOperational(page) {
  await page.goto(`${WEB_BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', OPERATIONAL_EMAIL);
  await page.fill('input[type="password"]', OPERATIONAL_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 15000 });
}

async function main() {
  const state = {
    currentRole: "manager",
    options: [
      buildOption("opt-takeaway", "Take Away"),
      buildOption("opt-box", "Box", 1),
    ],
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await installApiMocks(page, state);
  await loginManager(page);

  // 1. Navigate to order options page
  await page.getByRole("link", { name: "Order Options" }).click();
  await page.waitForURL(/\/admin\/order-options/, { timeout: 15000 });
  await page.getByRole("heading", { name: "Order Options" }).waitFor();
  await page.getByText("Take Away").waitFor();
  console.log("PASS: Navigate to order options page");

  // 2. Create order option
  await page.getByRole("button", { name: "Add Order Option" }).click();
  const createDialog = page.getByRole("dialog");
  await createDialog.getByLabel("Name").fill("Dine-In");
  await createDialog.getByRole("button", { name: "Add Order Option" }).click();
  await page.getByText("Dine-In").waitFor({ timeout: 10000 });
  console.log("PASS: Create order option");

  // 3. Edit order option name
  const dineInRow = page.getByRole("row", { name: /Dine-In/ });
  await dineInRow.getByLabel("Edit order option").click();
  const editDialog = page.getByRole("dialog");
  const nameInput = editDialog.getByLabel("Name");
  await nameInput.fill("");
  await nameInput.fill("Dine In");
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  await page.getByText("Dine In").waitFor({ timeout: 10000 });
  console.log("PASS: Edit order option name");

  // 4. Delete an unused order option
  const dineInDeleteRow = page.getByRole("row", { name: /Dine In/ });
  await dineInDeleteRow.getByLabel("Delete order option").click();
  await page
    .locator(".fixed.inset-0")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await page.waitForTimeout(500);
  if (state.options.some((option) => option.name === "Dine In")) {
    throw new Error("Expected Dine In to be deleted");
  }
  console.log("PASS: Delete order option");

  // 5. Reorder options via drag
  await page.reload({ waitUntil: "networkidle" });
  const boxHandle = page.getByLabel("Drag to reorder").nth(1);
  const takeAwayHandle = page.getByLabel("Drag to reorder").first();
  const boxBox = await boxHandle.boundingBox();
  const takeAwayBox = await takeAwayHandle.boundingBox();
  if (!boxBox || !takeAwayBox) {
    throw new Error("Could not locate drag handles for reorder");
  }
  await page.mouse.move(
    boxBox.x + boxBox.width / 2,
    boxBox.y + boxBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    takeAwayBox.x + takeAwayBox.width / 2,
    takeAwayBox.y + takeAwayBox.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
  await page.waitForTimeout(800);
  await page.reload({ waitUntil: "networkidle" });
  const firstRowName = await page.locator("tbody tr").first().locator("td").nth(1).innerText();
  if (firstRowName !== "Box") {
    throw new Error(`Expected Box first after reorder, got ${firstRowName}`);
  }
  console.log("PASS: Reorder options via drag");

  // 6. Duplicate name shows error
  await page.getByRole("button", { name: "Add Order Option" }).click();
  const duplicateDialog = page.getByRole("dialog");
  await duplicateDialog.getByLabel("Name").fill("Take Away");
  await duplicateDialog.getByRole("button", { name: "Add Order Option" }).click();
  await duplicateDialog
    .getByText("Order option name already exists")
    .waitFor({ timeout: 10000 });
  console.log("PASS: Duplicate name shows error");

  // 7. Non-manager blocked
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  state.currentRole = "operational";
  await loginOperational(page);
  const navLink = page.getByRole("link", { name: "Order Options" });
  if (await navLink.count()) {
    throw new Error("Order Options nav should be hidden for operational");
  }
  await page.goto(`${WEB_BASE}/admin/order-options`, {
    waitUntil: "networkidle",
  });
  if (!page.url().includes("/admin/unauthorized") && !page.url().includes("/admin/suppliers")) {
    throw new Error(
      `Operational user should be redirected from order options, got ${page.url()}`,
    );
  }
  console.log("PASS: Non-manager blocked");

  await browser.close();
  console.log("All POS-85-3 browser checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
