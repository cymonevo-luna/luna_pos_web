#!/usr/bin/env node
/**
 * Browser verification for POS-153-4 purchase CSV export controls.
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
      uid: "operational-1",
      email: "operation-test@cymonevo.com",
      roles: ["operational"],
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

function csv(body, status = 200, filename = "purchase-requests-2026-07-25.csv") {
  return {
    status,
    contentType: "text/csv",
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
    body,
  };
}

function operationalUser(features) {
  return {
    id: "operational-1",
    email: "operation-test@cymonevo.com",
    name: "Operational Test",
    roles: ["operational"],
    features,
    merchant_id: "merchant-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
  };
}

function managerUser(features) {
  return {
    id: "manager-1",
    email: "manager-test@cymonevo.com",
    name: "Manager Test",
    roles: ["manager"],
    features,
    merchant_id: "merchant-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
  };
}

const purchaseRequests = [
  {
    id: "pr-1",
    supplier_id: "sup-1",
    supplier_name: "Beras Supplier",
    status: "PAID",
    item_count: 2,
    total_estimated_amount: 280000,
    created_by_username: "operational",
    created_at: "2026-07-25T10:30:00Z",
    updated_at: "2026-07-25T10:30:00Z",
  },
];

let lastExportStatus = null;

function buildExportCsv(status) {
  const rows = [
    "item_name,supplier_name,quantity,price_per_quantity,total_price",
    status === "PAID" || status === null
      ? "Beras,Beras Supplier,2,140000,280000"
      : "Should,Not,Appear,0,0",
  ];
  return rows.join("\n");
}

async function installApiMocks(page, { user, features }) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();

    if (pathname.endsWith("/api/v1/auth/login") && method === "POST") {
      return route.fulfill(
        json({
          success: true,
          data: {
            user,
            merchant: { id: "merchant-1", name: "Test Merchant" },
            tokens: {
              access_token: makeJwt({ features, uid: user.id }),
              refresh_token: makeJwt({ typ: "refresh", features, uid: user.id }),
              expires_in: 3600,
              refresh_expires_in: 86400,
            },
          },
        }),
      );
    }

    if (pathname.endsWith(`/api/v1/users/${user.id}`) && method === "GET") {
      return route.fulfill(json({ success: true, data: user }));
    }

    if (pathname.endsWith("/api/v1/auth/refresh") && method === "POST") {
      return route.fulfill(
        json({
          success: true,
          data: {
            tokens: {
              access_token: makeJwt({ features, uid: user.id }),
              refresh_token: makeJwt({ typ: "refresh", features, uid: user.id }),
              expires_in: 3600,
              refresh_expires_in: 86400,
            },
          },
        }),
      );
    }

    if (pathname.endsWith("/api/admin/purchase-requests/export") && method === "GET") {
      lastExportStatus = url.searchParams.get("status");
      const transactionDate = url.searchParams.get("transaction_date");
      if (!transactionDate) {
        return route.fulfill(
          json(
            {
              success: false,
              error: {
                code: "validation_error",
                message: "Invalid export parameters",
                fields: { transaction_date: "Transaction date is required" },
              },
            },
            422,
          ),
        );
      }
      return route.fulfill(
        csv(
          buildExportCsv(lastExportStatus),
          200,
          `purchase-requests-${transactionDate}.csv`,
        ),
      );
    }

    if (pathname.endsWith("/api/admin/purchase-requests") && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: purchaseRequests,
          meta: { page: 1, per_page: 10, total: purchaseRequests.length },
        }),
      );
    }

    return route.fulfill(json({ success: true, data: {} }));
  });
}

async function login(page, { user, features, email, password }) {
  await installApiMocks(page, { user, features });
  await page.goto(`${WEB_BASE}/admin/login`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForURL(
    (url) =>
      url.pathname.startsWith("/admin") && !url.pathname.startsWith("/admin/login"),
    { timeout: 15000 },
  );
}

async function withFreshPage(run) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  try {
    return await run(page);
  } finally {
    await browser.close();
  }
}

async function main() {
  const results = [];

  const exportVisible = await withFreshPage(async (page) => {
    await login(page, {
      user: operationalUser(["purchases.manage"]),
      features: ["purchases.manage"],
      email: "operation-test@cymonevo.com",
      password: "LunaTesting123!",
    });
    await page.goto(`${WEB_BASE}/admin/purchases`);
    await page.waitForSelector('[data-testid="purchase-export-section"]', {
      timeout: 10000,
    });
    return (
      (await page.getByTestId("export-transaction-date").count()) > 0 &&
      (await page.getByRole("button", { name: /Export/i }).count()) > 0
    );
  });
  results.push([
    "Export button visible for operational user",
    exportVisible ? "PASS" : "FAIL",
    "Export CSV section with date picker and Export button visible",
  ]);

  const exportDownloads = await withFreshPage(async (page) => {
    await login(page, {
      user: operationalUser(["purchases.manage"]),
      features: ["purchases.manage"],
      email: "operation-test@cymonevo.com",
      password: "LunaTesting123!",
    });
    await page.goto(`${WEB_BASE}/admin/purchases`);
    await page.waitForSelector('[data-testid="purchase-export-section"]');

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Export/i }).click(),
    ]);

    const path = await download.path();
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(path, "utf8");
    return (
      download.suggestedFilename().endsWith(".csv") &&
      content.includes(
        "item_name,supplier_name,quantity,price_per_quantity,total_price",
      ) &&
      content.includes("Beras,Beras Supplier")
    );
  });
  results.push([
    "Export downloads CSV file",
    exportDownloads ? "PASS" : "FAIL",
    "Downloaded CSV has expected header and data row",
  ]);

  lastExportStatus = null;
  const statusFilter = await withFreshPage(async (page) => {
    await login(page, {
      user: operationalUser(["purchases.manage"]),
      features: ["purchases.manage"],
      email: "operation-test@cymonevo.com",
      password: "LunaTesting123!",
    });
    await page.goto(`${WEB_BASE}/admin/purchases`);
    await page.waitForSelector('[data-testid="purchase-export-section"]');
    await page.getByTestId("export-status").selectOption("PAID");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Export/i }).click(),
    ]);
    const path = await download.path();
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(path, "utf8");
    return lastExportStatus === "PAID" && content.includes("Beras,Beras Supplier");
  });
  results.push([
    "Export status filter affects download",
    statusFilter ? "PASS" : "FAIL",
    "PAID export request sent status=PAID and CSV contains PAID row",
  ]);

  const exportHidden = await withFreshPage(async (page) => {
    await login(page, {
      user: managerUser(["transactions.view"]),
      features: ["transactions.view"],
      email: "manager-test@cymonevo.com",
      password: "LunaTesting123!",
    });
    await page.goto(`${WEB_BASE}/admin/purchases`);
    await page.waitForTimeout(1000);
    return (await page.getByTestId("purchase-export-section").count()) === 0;
  });
  results.push([
    "Export hidden without permission",
    exportHidden ? "PASS" : "FAIL",
    "Purchases page does not show Export CSV controls without purchases.manage",
  ]);

  const listLoads = await withFreshPage(async (page) => {
    await login(page, {
      user: operationalUser(["purchases.manage"]),
      features: ["purchases.manage"],
      email: "operation-test@cymonevo.com",
      password: "LunaTesting123!",
    });
    await page.goto(`${WEB_BASE}/admin/purchases`);
    await page.waitForSelector("text=Beras Supplier", { timeout: 10000 });
    return (await page.getByText("Beras Supplier").count()) > 0;
  });
  results.push([
    "Purchase list still loads after export UI added",
    listLoads ? "PASS" : "FAIL",
    "Existing purchase list renders with data",
  ]);

  console.log("\nPOS-153-4 browser verification\n");
  let failed = 0;
  for (const [name, status, note] of results) {
    console.log(`${status}  ${name} — ${note}`);
    if (status === "FAIL") failed += 1;
  }
  console.log(`\n${results.length - failed}/${results.length} passed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
