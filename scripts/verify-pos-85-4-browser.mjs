#!/usr/bin/env node
/**
 * Browser smoke for POS-85-4: order option ingredients editor.
 * Mocks admin order-options and food-supplies APIs.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
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

function buildOption(id, name, ingredientCount = 0) {
  return {
    id,
    name,
    priority: 10,
    ingredient_count: ingredientCount,
    created_at: "2026-03-01T08:00:00Z",
    updated_at: "2026-03-01T08:00:00Z",
  };
}

const FOOD_SUPPLIES = [
  {
    id: "fs-paper",
    title: "Paper",
    description: null,
    stock_quantity: "500",
    unit: "piece",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    manual_edit_history: [],
    cooking_measurements: [],
  },
  {
    id: "fs-food-paper",
    title: "Food paper",
    description: null,
    stock_quantity: "300",
    unit: "piece",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    manual_edit_history: [],
    cooking_measurements: [],
  },
  {
    id: "fs-box",
    title: "Box",
    description: null,
    stock_quantity: "100",
    unit: "piece",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    manual_edit_history: [],
    cooking_measurements: [],
  },
];

function ingredientRow(foodSupplyId, quantity, title, unit, stock) {
  return {
    food_supply_id: foodSupplyId,
    quantity: String(quantity),
    food_supply_title: title,
    food_supply_unit: unit,
    current_stock_quantity: String(stock),
  };
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
              id: "user-mgr",
              email: MANAGER_EMAIL,
              name: "Test Manager",
              roles: ["manager"],
              merchant_id: "merchant-1",
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
            merchant: {
              id: "merchant-1",
              name: "Test Merchant",
            },
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

    if (pathname.includes("/api/v1/users/") && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: {
            id: "user-mgr",
            email: MANAGER_EMAIL,
            name: "Test Manager",
            roles: ["manager"],
            merchant_id: "merchant-1",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        }),
      );
    }

    if (pathname.startsWith("/api/admin/food-supplies") && method === "GET") {
      const search = url.searchParams.get("search")?.toLowerCase() ?? "";
      let supplies = FOOD_SUPPLIES;
      if (search) {
        supplies = supplies.filter((supply) =>
          supply.title.toLowerCase().includes(search),
        );
      }
      return route.fulfill(
        json({
          success: true,
          data: supplies,
          meta: { page: 1, per_page: 20, total: supplies.length },
        }),
      );
    }

    if (pathname.startsWith("/api/admin/order-options")) {
      const ingredientsMatch = pathname.match(
        /^\/api\/admin\/order-options\/([^/]+)\/ingredients$/,
      );
      const detailMatch = pathname.match(/^\/api\/admin\/order-options\/([^/]+)$/);

      if (method === "GET" && pathname === "/api/admin/order-options") {
        return route.fulfill(
          json({
            success: true,
            data: state.options,
            meta: {
              page: 1,
              per_page: 100,
              total: state.options.length,
            },
          }),
        );
      }

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

      if (method === "GET" && ingredientsMatch) {
        const optionId = ingredientsMatch[1];
        const option = state.options.find((item) => item.id === optionId);
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
        const ingredients = state.ingredientsByOption[optionId] ?? [];
        return route.fulfill(
          json({
            success: true,
            data: {
              order_option_id: optionId,
              ingredients,
            },
          }),
        );
      }

      if (method === "PUT" && ingredientsMatch) {
        const optionId = ingredientsMatch[1];
        const option = state.options.find((item) => item.id === optionId);
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

        const payload = request.postDataJSON();
        const rows = payload.ingredients ?? [];

        if (state.forceInvalidFoodSupply) {
          state.forceInvalidFoodSupply = false;
          return route.fulfill(
            json(
              {
                success: false,
                error: {
                  code: "validation_error",
                  message: "Validation failed",
                  fields: {
                    "ingredients[0].food_supply_id": "Invalid food supply",
                  },
                },
              },
              422,
            ),
          );
        }

        for (const row of rows) {
          const qty = Number(row.quantity);
          if (!row.food_supply_id || !Number.isFinite(qty) || qty <= 0) {
            return route.fulfill(
              json(
                {
                  success: false,
                  error: {
                    code: "validation_error",
                    message: "Validation failed",
                  },
                },
                422,
              ),
            );
          }
        }

        const ingredients = rows.map((row) => {
          const supply = FOOD_SUPPLIES.find((item) => item.id === row.food_supply_id);
          return ingredientRow(
            row.food_supply_id,
            row.quantity,
            supply?.title ?? "Unknown",
            supply?.unit ?? "piece",
            supply?.stock_quantity ?? "0",
          );
        });

        state.ingredientsByOption[optionId] = ingredients;
        option.ingredient_count = ingredients.length;

        return route.fulfill(
          json({
            success: true,
            data: {
              order_option_id: optionId,
              ingredients,
            },
          }),
        );
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

async function openFoodSupplyPicker(page, ingredientLabel) {
  await page.getByLabel(ingredientLabel, { exact: true }).click();
  await page.getByRole("listbox").waitFor();
}

async function selectFoodSupply(page, title) {
  await page
    .getByRole("option", { name: new RegExp(`^${title} ·`, "i") })
    .click();
}

async function expectIngredientPicker(page, label, title) {
  const picker = page.getByLabel(label, { exact: true });
  await picker.waitFor();
  const text = await picker.innerText();
  if (!text.includes(title)) {
    throw new Error(`Expected ${label} to show ${title}, got ${text}`);
  }
}

async function main() {
  const state = {
    options: [buildOption("opt-takeaway", "Take Away")],
    ingredientsByOption: {
      "opt-takeaway": [],
    },
    forceInvalidFoodSupply: false,
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await installApiMocks(page, state);
  await loginManager(page);

  // 1. Open ingredients editor
  await page.getByRole("link", { name: "Order Options" }).click();
  await page.waitForURL(/\/admin\/order-options/, { timeout: 15000 });
  const takeAwayRow = page.getByRole("row", { name: /Take Away/ });
  await takeAwayRow.getByLabel("Manage ingredients").click();
  await page.waitForURL(/\/admin\/order-options\/opt-takeaway\/ingredients/, {
    timeout: 15000,
  });
  await page.getByRole("heading", { name: "Ingredients — Take Away" }).waitFor();
  console.log("PASS: Open ingredients editor");

  // 2. Add ingredient rows
  await page.getByRole("button", { name: "Add ingredient" }).click();
  await openFoodSupplyPicker(page, "Ingredient 1");
  await selectFoodSupply(page, "Paper");
  await page.getByLabel("Quantity per order").fill("1");

  await page.getByRole("button", { name: "Add ingredient" }).click();
  await openFoodSupplyPicker(page, "Ingredient 2");
  await selectFoodSupply(page, "Food paper");
  const quantityInputs = page.getByLabel("Quantity per order");
  await quantityInputs.nth(1).fill("1");

  await page.getByRole("button", { name: "Save ingredients" }).click();
  await page.getByText("Ingredients saved").waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: "networkidle" });
  await expectIngredientPicker(page, "Ingredient 1", "Paper");
  await expectIngredientPicker(page, "Ingredient 2", "Food paper");
  const units = await page.locator("text=piece").count();
  if (units < 2) {
    throw new Error("Expected units to display for both ingredients");
  }
  console.log("PASS: Add ingredient rows");

  // 3. Replace ingredient formula
  await page.getByLabel("Remove ingredient 1").click();
  await page.getByRole("button", { name: "Add ingredient" }).click();
  await openFoodSupplyPicker(page, "Ingredient 2");
  await selectFoodSupply(page, "Box");
  await page.getByLabel("Quantity per order").nth(1).fill("1");
  await page.getByRole("button", { name: "Save ingredients" }).click();
  await page.waitForTimeout(500);
  const saved = state.ingredientsByOption["opt-takeaway"] ?? [];
  if (saved.length !== 2) {
    throw new Error(`Expected 2 ingredients after replace, got ${saved.length}`);
  }
  if (!saved.some((row) => row.food_supply_title === "Box")) {
    throw new Error("Expected Box in saved formula");
  }
  if (saved.some((row) => row.food_supply_title === "Paper")) {
    throw new Error("Expected Paper removed from saved formula");
  }
  console.log("PASS: Replace ingredient formula");

  // 4. Show current stock
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("p.text-muted-foreground", { hasText: "300 pcs" }).waitFor();
  await page.locator("p.text-muted-foreground", { hasText: "100 pcs" }).waitFor();
  console.log("PASS: Show current stock");

  // 5. Reject zero quantity
  await page.getByLabel("Quantity per order").first().fill("0");
  await page.getByRole("button", { name: "Save ingredients" }).click();
  await page.getByText("Enter a quantity greater than 0").waitFor({
    timeout: 5000,
  });
  console.log("PASS: Reject zero quantity");

  // 6. Empty formula allowed
  await page.getByLabel("Remove ingredient 1").click();
  await page.getByLabel("Remove ingredient 1").click();
  await page.getByRole("button", { name: "Save ingredients" }).click();
  await page.getByText("Ingredients saved").waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("No ingredients yet").waitFor();
  if ((state.ingredientsByOption["opt-takeaway"] ?? []).length !== 0) {
    throw new Error("Expected empty formula after clearing all rows");
  }
  console.log("PASS: Empty formula allowed");

  // 7. Invalid food supply error
  state.forceInvalidFoodSupply = true;
  await page.getByRole("button", { name: "Add ingredient" }).click();
  await openFoodSupplyPicker(page, "Ingredient 1");
  await selectFoodSupply(page, "Paper");
  await page.getByLabel("Quantity per order").fill("1");
  await page.getByRole("button", { name: "Save ingredients" }).click();
  await page.getByText("Invalid food supply").waitFor({ timeout: 5000 });
  console.log("PASS: Invalid food supply error");

  await browser.close();
  console.log("All POS-85-4 browser checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
