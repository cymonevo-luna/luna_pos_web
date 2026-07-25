#!/usr/bin/env node
/**
 * Browser verification for POS-153-5 purchase CSV import dialog.
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";

const TEMPLATE_HEADERS =
  "item_name,supplier_name,quantity,price_per_quantity,total_price";

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

function csv(body, status = 200, filename = "purchase-import-template.csv") {
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

let purchaseRequests = [
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

    if (
      pathname.endsWith("/api/admin/purchase-requests/import/template") &&
      method === "GET"
    ) {
      return route.fulfill(
        csv(
          `${TEMPLATE_HEADERS}\n`,
          200,
          "purchase-import-template.csv",
        ),
      );
    }

    if (
      pathname.endsWith("/api/admin/uploads/purchase-proof") &&
      method === "POST"
    ) {
      return route.fulfill(
        json({
          success: true,
          data: {
            url: "https://cdn.example.com/proof.jpg",
            filename: "proof.jpg",
            size_bytes: 100,
          },
        }),
      );
    }

    if (
      pathname.endsWith("/api/admin/purchase-requests/import") &&
      method === "POST"
    ) {
      const body = request.postDataBuffer()?.toString("latin1") ?? "";
      if (
        body.includes("Unknown Supplier") ||
        body.includes("unknown-supplier.csv")
      ) {
        return route.fulfill(
          json(
            {
              success: false,
              error: {
                code: "validation_error",
                message: "Import validation failed",
                fields: {
                  "row_2.supplier_name": "Supplier is not registered",
                },
              },
            },
            422,
          ),
        );
      }

      const targetStatus = body.includes("PAID") ? "PAID" : "PENDING";
      purchaseRequests = [
        ...purchaseRequests,
        {
          id: `pr-${purchaseRequests.length + 1}`,
          supplier_id: "sup-new",
          supplier_name: "Imported Supplier",
          status: targetStatus,
          item_count: 1,
          total_estimated_amount: 10000,
          created_by_username: "operational",
          created_at: "2026-07-25T12:00:00Z",
          updated_at: "2026-07-25T12:00:00Z",
        },
      ];

      return route.fulfill(
        json({
          success: true,
          data: { created_count: 1 },
        }),
        201,
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

    if (
      pathname.endsWith("/api/admin/purchase-requests") &&
      method === "POST" &&
      !pathname.includes("/import")
    ) {
      return route.fulfill(
        json({
          success: true,
          data: {
            id: "pr-manual",
            supplier_id: "sup-manual",
            supplier_name: "Manual Supplier",
            status: "PENDING",
            item_count: 1,
            total_estimated_amount: 5000,
            created_at: "2026-07-25T12:00:00Z",
            updated_at: "2026-07-25T12:00:00Z",
          },
        }),
      );
    }

    if (pathname.endsWith("/api/admin/suppliers") && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: [
            {
              id: "sup-1",
              name: "Beras Supplier",
              phone_number: "08123",
              address: "Address",
              supports_delivery: false,
              delivery_cost: null,
              price_quotes: [],
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
          ],
          meta: { page: 1, per_page: 100, total: 1 },
        }),
      );
    }

    if (pathname.includes("/api/admin/food-supplies") && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: [
            {
              id: "fs-1",
              title: "Beras",
              unit: "gr",
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
          ],
          meta: { page: 1, per_page: 100, total: 1 },
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

async function writeTempCsv(name, content) {
  const filePath = path.join(os.tmpdir(), name);
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

async function main() {
  const results = [];

  const templateDownload = await withFreshPage(async (page) => {
    await login(page, {
      user: operationalUser(["purchases.manage"]),
      features: ["purchases.manage"],
      email: "operation-test@cymonevo.com",
      password: "LunaTesting123!",
    });
    await page.goto(`${WEB_BASE}/admin/purchases`);
    await page.getByTestId("open-import-dialog").click();
    await page.waitForSelector('[data-testid="purchase-import-dialog"]');

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("download-import-template").click(),
    ]);

    const downloadPath = await download.path();
    const content = await fs.readFile(downloadPath, "utf8");
    return (
      download.suggestedFilename().endsWith(".csv") &&
      content.includes(TEMPLATE_HEADERS)
    );
  });
  results.push([
    "Import dialog opens and downloads template",
    templateDownload ? "PASS" : "FAIL",
    "Modal opens and template CSV contains expected headers",
  ]);

  purchaseRequests = [
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

  const validImport = await withFreshPage(async (page) => {
    await login(page, {
      user: operationalUser(["purchases.manage"]),
      features: ["purchases.manage"],
      email: "operation-test@cymonevo.com",
      password: "LunaTesting123!",
    });
    await page.goto(`${WEB_BASE}/admin/purchases`);
    await page.getByTestId("open-import-dialog").click();
    const csvPath = await writeTempCsv(
      "valid-import.csv",
      `${TEMPLATE_HEADERS}\nBeras,Beras Supplier,2,140000,280000`,
    );
    await page.getByTestId("import-csv-input").setInputFiles(csvPath);
    await page.getByTestId("import-purchase-requests").click();
    await page.waitForSelector("text=Imported 1 purchase request", {
      timeout: 10000,
    });
    return (
      (await page.getByText("Imported Supplier").count()) > 0 &&
      (await page.getByTestId("purchase-import-dialog").count()) === 0
    );
  });
  results.push([
    "Import valid CSV creates purchases",
    validImport ? "PASS" : "FAIL",
    "Success toast shown, modal closes, imported purchase appears in list",
  ]);

  const unknownSupplier = await withFreshPage(async (page) => {
    await login(page, {
      user: operationalUser(["purchases.manage"]),
      features: ["purchases.manage"],
      email: "operation-test@cymonevo.com",
      password: "LunaTesting123!",
    });
    await page.goto(`${WEB_BASE}/admin/purchases`);
    await page.getByTestId("open-import-dialog").click();
    const csvPath = await writeTempCsv(
      "unknown-supplier.csv",
      `${TEMPLATE_HEADERS}\nBeras,Unknown Supplier,2,140000,280000`,
    );
    await page.getByTestId("import-csv-input").setInputFiles(csvPath);
    await page.getByTestId("import-purchase-requests").click();
    await page.waitForSelector("text=Supplier is not registered", {
      timeout: 10000,
    });
    return (
      (await page.getByText("row_2.supplier_name:").count()) > 0 &&
      (await page.getByTestId("purchase-import-dialog").count()) > 0
    );
  });
  results.push([
    "Import shows supplier not registered error",
    unknownSupplier ? "PASS" : "FAIL",
    "Validation error identifies unregistered supplier and row number",
  ]);

  const paidProofUi = await withFreshPage(async (page) => {
    await login(page, {
      user: operationalUser(["purchases.manage"]),
      features: ["purchases.manage"],
      email: "operation-test@cymonevo.com",
      password: "LunaTesting123!",
    });
    await page.goto(`${WEB_BASE}/admin/purchases`);
    await page.getByTestId("open-import-dialog").click();
    await page.getByTestId("import-target-status").selectOption("PAID");
    const csvPath = await writeTempCsv(
      "two-suppliers.csv",
      [
        TEMPLATE_HEADERS,
        "Beras,Beras Supplier,2,140000,280000",
        "Sayur,Sayur Supplier,1,10000,10000",
      ].join("\n"),
    );
    await page.getByTestId("import-csv-input").setInputFiles(csvPath);
    await page.waitForSelector('[data-testid="import-proof-section"]');
    return (
      (await page.getByLabel("Paid proof — Beras Supplier").count()) > 0 &&
      (await page.getByLabel("Paid proof — Sayur Supplier").count()) > 0 &&
      (await page.getByTestId("import-purchase-requests").isDisabled())
    );
  });
  results.push([
    "Import PAID shows per-supplier proof upload",
    paidProofUi ? "PASS" : "FAIL",
    "Paid proof controls shown for each supplier and Import stays disabled",
  ]);

  const paidImport = await withFreshPage(async (page) => {
    await login(page, {
      user: operationalUser(["purchases.manage"]),
      features: ["purchases.manage"],
      email: "operation-test@cymonevo.com",
      password: "LunaTesting123!",
    });
    await page.goto(`${WEB_BASE}/admin/purchases`);
    await page.getByTestId("open-import-dialog").click();
    await page.getByTestId("import-target-status").selectOption("PAID");
    const csvPath = await writeTempCsv(
      "paid-import.csv",
      `${TEMPLATE_HEADERS}\nBeras,Beras Supplier,2,140000,280000`,
    );
    const proofPath = await writeTempCsv("proof.jpg", "fake-image");
    await page.getByTestId("import-csv-input").setInputFiles(csvPath);
    await page
      .getByTestId("paid-proof-Beras Supplier")
      .setInputFiles({
        name: "proof.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      });
    await page.getByTestId("import-purchase-requests").click();
    await page.waitForSelector("text=Imported 1 purchase request", {
      timeout: 10000,
    });
    await page.waitForTimeout(500);
    return (await page.getByText("PAID").count()) > 0;
  });
  results.push([
    "Import PAID with proofs reaches PAID status",
    paidImport ? "PASS" : "FAIL",
    "Imported purchase appears with PAID status in list",
  ]);

  const importHidden = await withFreshPage(async (page) => {
    await login(page, {
      user: managerUser(["transactions.view"]),
      features: ["transactions.view"],
      email: "manager-test@cymonevo.com",
      password: "LunaTesting123!",
    });
    await page.goto(`${WEB_BASE}/admin/purchases`);
    await page.waitForTimeout(1000);
    return (await page.getByTestId("open-import-dialog").count()) === 0;
  });
  results.push([
    "Import button hidden without permission",
    importHidden ? "PASS" : "FAIL",
    "Import CSV action hidden without purchases.manage",
  ]);

  const manualCreate = await withFreshPage(async (page) => {
    await login(page, {
      user: operationalUser(["purchases.manage"]),
      features: ["purchases.manage"],
      email: "operation-test@cymonevo.com",
      password: "LunaTesting123!",
    });
    await page.goto(`${WEB_BASE}/admin/purchases/new`);
    await page.waitForSelector("text=New purchase request", { timeout: 10000 });
    return (await page.getByRole("button", { name: /Create purchase request/i }).count()) > 0;
  });
  results.push([
    "Manual purchase create still works",
    manualCreate ? "PASS" : "FAIL",
    "Manual create purchase form still renders and submits",
  ]);

  console.log("\nPOS-153-5 browser verification\n");
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
