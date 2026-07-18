#!/usr/bin/env node
/**
 * Browser verification for POS-113-3 Smart Request wizard.
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

const foodSupplies = [
  {
    id: "fs-rice",
    title: "Rice",
    description: null,
    stock_quantity: 1000,
    unit: "gr",
    manual_edit_history: [],
    cooking_measurements: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "fs-salt",
    title: "Salt",
    description: null,
    stock_quantity: 500,
    unit: "gr",
    manual_edit_history: [],
    cooking_measurements: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "fs-unmatched",
    title: "Unmatched Spice",
    description: null,
    stock_quantity: 100,
    unit: "gr",
    manual_edit_history: [],
    cooking_measurements: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const supplierCatalog = {
  "sup-a": {
    id: "sup-a",
    name: "Supplier A",
    phone_number: "08111111111",
    address: "Address A",
    supports_delivery: false,
    delivery_cost: null,
    price_quotes: [
      {
        id: "price-a-rice",
        food_supply_id: "fs-rice",
        food_supply_title: "Rice",
        unit: "gr",
        price_amount: 100000,
        price_quantity: 1000,
      },
      {
        id: "price-a-salt",
        food_supply_id: "fs-salt",
        food_supply_title: "Salt",
        unit: "gr",
        price_amount: 5000,
        price_quantity: 1000,
      },
    ],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  "sup-b": {
    id: "sup-b",
    name: "Supplier B",
    phone_number: "08222222222",
    address: "Address B",
    supports_delivery: false,
    delivery_cost: null,
    price_quotes: [
      {
        id: "price-b-rice",
        food_supply_id: "fs-rice",
        food_supply_title: "Rice",
        unit: "gr",
        price_amount: 150000,
        price_quantity: 1000,
      },
    ],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
};

let purchaseRequests = [];
let suggestMode = "matched";
let batchCalled = false;
let suggestCalled = false;

function buildSuggestResponse(items) {
  if (suggestMode === "unmatched") {
    return {
      items: items.map((item) => ({
        food_supply_id: item.food_supply_id,
        food_supply_title:
          foodSupplies.find((supply) => supply.id === item.food_supply_id)?.title ??
          "Unknown",
        quantity: item.quantity,
        unit: "gr",
        has_supplier_price: false,
        selected_supplier_id: null,
        selected_supplier_name: null,
        price_amount: 0,
        price_quantity: 1000,
        unit_price: 0,
        line_estimated_amount: 0,
        all_supplier_quotes: [],
      })),
      grouped_by_supplier: [],
    };
  }

  const suggestItems = items.map((item) => {
    const isRice = item.food_supply_id === "fs-rice";
    const selectedSupplierId = isRice ? "sup-a" : "sup-a";
    const quotes = isRice
      ? [
          {
            supplier_id: "sup-a",
            supplier_name: "Supplier A",
            price_amount: 100000,
            price_quantity: 1000,
            unit_price: 100,
          },
          {
            supplier_id: "sup-b",
            supplier_name: "Supplier B",
            price_amount: 150000,
            price_quantity: 1000,
            unit_price: 150,
          },
        ]
      : [
          {
            supplier_id: "sup-a",
            supplier_name: "Supplier A",
            price_amount: 5000,
            price_quantity: 1000,
            unit_price: 5,
          },
        ];

    const selected = quotes[0];
    const quantity = Number(item.quantity);
    const lineTotal = Math.round(
      (quantity * selected.price_amount) / selected.price_quantity,
    );

    return {
      food_supply_id: item.food_supply_id,
      food_supply_title:
        foodSupplies.find((supply) => supply.id === item.food_supply_id)?.title ??
        "Unknown",
      quantity,
      unit: "gr",
      has_supplier_price: true,
      selected_supplier_id: selected.supplier_id,
      selected_supplier_name: selected.supplier_name,
      price_amount: selected.price_amount,
      price_quantity: selected.price_quantity,
      unit_price: selected.unit_price,
      line_estimated_amount: lineTotal,
      all_supplier_quotes: quotes,
    };
  });

  const grouped = new Map();
  for (const item of suggestItems) {
    const supplierId = item.selected_supplier_id;
    if (!grouped.has(supplierId)) {
      grouped.set(supplierId, {
        supplier_id: supplierId,
        supplier_name: item.selected_supplier_name,
        items: [],
        group_total_estimated_amount: 0,
      });
    }
    const group = grouped.get(supplierId);
    group.items.push(item);
    group.group_total_estimated_amount += item.line_estimated_amount;
  }

  return {
    items: suggestItems,
    grouped_by_supplier: Array.from(grouped.values()),
  };
}

async function installApiMocks(page, features) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;

    if (pathname.endsWith("/api/v1/auth/login") && method === "POST") {
      const user = operationalUser(features);
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

    if (pathname.endsWith("/api/v1/users/operational-1") && method === "GET") {
      return route.fulfill(
        json({ success: true, data: operationalUser(features) }),
      );
    }

    if (pathname.endsWith("/api/v1/auth/refresh") && method === "POST") {
      const user = operationalUser(features);
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

    if (pathname.endsWith("/api/admin/purchase-requests") && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: purchaseRequests,
          meta: { page: 1, per_page: 10, total: purchaseRequests.length },
        }),
      );
    }

    if (pathname.endsWith("/api/admin/purchase-requests/suggest") && method === "POST") {
      suggestCalled = true;
      const body = JSON.parse(request.postData() ?? "{}");
      return route.fulfill(
        json({ success: true, data: buildSuggestResponse(body.items ?? []) }),
      );
    }

    if (pathname.endsWith("/api/admin/purchase-requests/batch") && method === "POST") {
      batchCalled = true;
      const body = JSON.parse(request.postData() ?? "{}");
      purchaseRequests = (body.groups ?? []).map((group, index) => ({
        id: `pr-batch-${index + 1}`,
        supplier_id: group.supplier_id,
        supplier_name:
          group.supplier_id === "sup-a"
            ? "Supplier A"
            : group.supplier_id === "sup-b"
              ? "Supplier B"
              : "Manual Supplier",
        status: "PENDING",
        item_count: group.items?.length ?? 0,
        total_estimated_amount: 205,
        created_by_username: "Operational Test",
        created_at: "2026-07-18T00:00:00Z",
        updated_at: "2026-07-18T00:00:00Z",
      }));
      return route.fulfill(
        json(
          {
            success: true,
            data: {
              purchase_requests: purchaseRequests.map((purchase) => ({
                ...purchase,
                supplier_contact_info: "08111111111",
                notes: body.notes ?? null,
                items: [],
                status_history: [],
              })),
            },
          },
          201,
        ),
      );
    }

    if (pathname.endsWith("/api/admin/purchase-requests") && method === "POST") {
      const body = JSON.parse(request.postData() ?? "{}");
      const created = {
        id: "pr-manual-1",
        supplier_id: body.supplier_id,
        supplier_name:
          body.supplier_id === "sup-a" ? "Supplier A" : "Supplier B",
        supplier_contact_info: "08111111111",
        status: "PENDING",
        notes: body.notes ?? null,
        items: [],
        status_history: [],
        total_estimated_amount: 200,
        created_at: "2026-07-18T00:00:00Z",
        updated_at: "2026-07-18T00:00:00Z",
      };
      return route.fulfill(json({ success: true, data: created }, 201));
    }

    if (pathname.endsWith("/api/admin/food-supplies") && method === "GET") {
      const search = url.searchParams.get("search")?.toLowerCase() ?? "";
      const filtered = foodSupplies.filter((supply) =>
        supply.title.toLowerCase().includes(search),
      );
      return route.fulfill(
        json({
          success: true,
          data: filtered,
          meta: { page: 1, per_page: 20, total: filtered.length },
        }),
      );
    }

    if (
      pathname.endsWith("/api/admin/food-supplies/fs-unmatched/supplier-prices") &&
      method === "GET"
    ) {
      return route.fulfill(
        json({
          success: true,
          data: [
            {
              id: "price-manual",
              supplier_id: "sup-manual",
              supplier_name: "Manual Supplier",
              food_supply_id: "fs-unmatched",
              unit: "gr",
              price_amount: 120000,
              price_quantity: 1000,
            },
          ],
        }),
      );
    }

    const supplierMatch = pathname.match(/\/api\/admin\/suppliers\/([^/]+)$/);
    if (supplierMatch && method === "GET") {
      const supplier = supplierCatalog[supplierMatch[1]];
      if (supplier) {
        return route.fulfill(json({ success: true, data: supplier }));
      }
    }

    if (pathname.endsWith("/api/admin/suppliers") && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: Object.values(supplierCatalog),
          meta: { page: 1, per_page: 20, total: Object.keys(supplierCatalog).length },
        }),
      );
    }

    return route.fulfill(json({ success: true, data: {} }));
  });
}

async function loginOperational(page, features) {
  await installApiMocks(page, features);
  await page.goto(`${WEB_BASE}/admin/login`);
  await page.locator("#email").fill("operation-test@cymonevo.com");
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

async function pickFoodSupply(page, rowLabel, supplyTitle) {
  const pickerButton = page.getByRole("button", { name: "Select a food supply" }).first();
  if ((await pickerButton.count()) === 0) {
    await page.locator(`label:has-text("${rowLabel}")`).locator("..").getByRole("button").click();
  } else {
    await pickerButton.click();
  }
  await page.getByRole("listbox").waitFor({ timeout: 10000 });
  await page
    .getByRole("listbox")
    .getByRole("button", { name: new RegExp(supplyTitle) })
    .click();
}

async function main() {
  const features = ["purchases.manage"];
  const results = [];

  const entryVisible = await withFreshPage(async (page) => {
    await loginOperational(page, features);
    await page.goto(`${WEB_BASE}/admin/purchases`);
    await page.waitForSelector('[data-testid="smart-purchase-request-link"]', {
      timeout: 10000,
    });
    return (await page.getByTestId("smart-purchase-request-link").count()) > 0;
  });
  results.push([
    "Smart Request entry visible on purchases page",
    entryVisible ? "PASS" : "FAIL",
    "Smart Request link shown next to manual create",
  ]);

  suggestCalled = false;
  const ingredientStep = await withFreshPage(async (page) => {
    await loginOperational(page, features);
    await page.goto(`${WEB_BASE}/admin/purchases/smart`);
    await page.getByRole("button", { name: /add ingredient/i }).click();
    await pickFoodSupply(page, "Ingredient 1", "Rice");
    await page.getByLabel("Quantity").first().fill("2");
    await page.getByRole("button", { name: /add ingredient/i }).click();
    await pickFoodSupply(page, "Ingredient 2", "Salt");
    await page.getByLabel("Quantity").nth(1).fill("1");
    await page.getByTestId("smart-purchase-continue").click();
    await page.waitForSelector('[data-testid="smart-purchase-review-step"]', {
      timeout: 10000,
    });
    return suggestCalled;
  });
  results.push([
    "Ingredient step validates and calls suggest",
    ingredientStep ? "PASS" : "FAIL",
    "Continue called suggest and rendered review step",
  ]);

  const cheapestSelected = await withFreshPage(async (page) => {
    await loginOperational(page, features);
    await page.goto(`${WEB_BASE}/admin/purchases/smart`);
    await page.getByRole("button", { name: /add ingredient/i }).click();
    await pickFoodSupply(page, "Ingredient 1", "Rice");
    await page.getByLabel("Quantity").first().fill("2");
    await page.getByTestId("smart-purchase-continue").click();
    await page.waitForSelector('[data-testid="review-item-fs-rice"]');
    const supplierValue = await page
      .getByTestId("supplier-select-fs-rice")
      .inputValue();
    const lineTotal = await page.getByTestId("line-total-fs-rice").innerText();
    return supplierValue === "sup-a" && lineTotal.includes("200");
  });
  results.push([
    "Review shows cheapest supplier pre-selected",
    cheapestSelected ? "PASS" : "FAIL",
    "Cheaper Supplier A selected with Rp 200 line total",
  ]);

  const overrideSupplier = await withFreshPage(async (page) => {
    await loginOperational(page, features);
    await page.goto(`${WEB_BASE}/admin/purchases/smart`);
    await page.getByRole("button", { name: /add ingredient/i }).click();
    await pickFoodSupply(page, "Ingredient 1", "Rice");
    await page.getByLabel("Quantity").first().fill("2");
    await page.getByTestId("smart-purchase-continue").click();
    await page.waitForSelector('[data-testid="supplier-select-fs-rice"]');
    await page.getByTestId("supplier-select-fs-rice").selectOption("sup-b");
    const lineTotal = await page.getByTestId("line-total-fs-rice").innerText();
    const regrouped = await page.getByTestId("supplier-group-sup-b").count();
    return lineTotal.includes("300") && regrouped > 0;
  });
  results.push([
    "Override supplier per item",
    overrideSupplier ? "PASS" : "FAIL",
    "Line total updated and item moved to Supplier B group",
  ]);

  purchaseRequests = [];
  batchCalled = false;
  const confirmBatch = await withFreshPage(async (page) => {
    await loginOperational(page, features);
    await page.goto(`${WEB_BASE}/admin/purchases/smart`);
    await page.getByRole("button", { name: /add ingredient/i }).click();
    await pickFoodSupply(page, "Ingredient 1", "Rice");
    await page.getByLabel("Quantity").first().fill("2");
    await page.getByTestId("smart-purchase-continue").click();
    await page.waitForSelector('[data-testid="smart-purchase-confirm"]');
    await page.getByTestId("smart-purchase-confirm").click();
    await page.waitForURL(/\/admin\/purchases$/, { timeout: 10000 });
    const pendingVisible = (await page.getByText("PENDING").count()) > 0;
    return batchCalled && pendingVisible;
  });
  results.push([
    "Confirm submits batch and lands on list",
    confirmBatch ? "PASS" : "FAIL",
    "Batch API called and purchases list shows PENDING request",
  ]);

  suggestMode = "unmatched";
  const unmatchedBlocks = await withFreshPage(async (page) => {
    await loginOperational(page, features);
    await page.goto(`${WEB_BASE}/admin/purchases/smart`);
    await page.getByRole("button", { name: /add ingredient/i }).click();
    await pickFoodSupply(page, "Ingredient 1", "Unmatched Spice");
    await page.getByLabel("Quantity").first().fill("2");
    await page.getByTestId("smart-purchase-continue").click();
    await page.waitForSelector('[data-testid="unmatched-supplier-badge"]');
    const disabled = await page.getByTestId("smart-purchase-confirm").isDisabled();
    await page.getByTestId("supplier-select-fs-unmatched").selectOption("sup-manual");
    const enabled = await page.getByTestId("smart-purchase-confirm").isEnabled();
    return disabled && enabled;
  });
  suggestMode = "matched";
  results.push([
    "Unmatched item blocks confirm",
    unmatchedBlocks ? "PASS" : "FAIL",
    "Warning shown; Confirm disabled until manual supplier selected",
  ]);

  const manualCreate = await withFreshPage(async (page) => {
    await loginOperational(page, features);
    await page.goto(`${WEB_BASE}/admin/purchases/new`);
    await page.locator("#purchase-request-supplier").click();
    await page.getByRole("listbox").getByRole("button", { name: /Supplier A/ }).click();
    await page.waitForSelector("text=Add line item");
    await page.getByRole("button", { name: /add line item/i }).click();
    await page.locator("select").first().selectOption({ index: 1 });
    await page.getByLabel("Quantity").fill("2");
    await page.getByRole("button", { name: /create purchase request/i }).click();
    await page.waitForURL(/\/admin\/purchases\/pr-manual-1$/, { timeout: 10000 });
    return page.url().includes("/admin/purchases/pr-manual-1");
  });
  results.push([
    "Regression manual purchase create still works",
    manualCreate ? "PASS" : "FAIL",
    "Supplier-first manual create still redirects to detail page",
  ]);

  console.log("\nPOS-113-3 browser verification\n");
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
