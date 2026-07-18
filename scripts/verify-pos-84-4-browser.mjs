#!/usr/bin/env node
/**
 * Browser verification for POS-84-4: cooking measurement quantity entry on menu ingredients editor.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const MANAGER_EMAIL =
  process.env.TEST_MANAGER_EMAIL ?? "manager-test@cymonevo.com";
const MANAGER_PASSWORD =
  process.env.TEST_MANAGER_PASSWORD ?? "LunaTesting123!";

const menuId = "menu-verify-84-4";
const riceSupplyId = "fs-rice-84-4";
const saltSupplyId = "fs-salt-84-4";
const tbspId = "cm-tbsp-84-4";

function makeJwt(claims = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url",
  );
  const body = Buffer.from(
    JSON.stringify({
      uid: "user-manager-84-4",
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

function buildFoodSupply(id, title, unit, cookingMeasurements = []) {
  return {
    id,
    title,
    description: null,
    stock_quantity: "1000",
    unit,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    manual_edit_history: [],
    cooking_measurements: cookingMeasurements,
  };
}

function buildMenu() {
  return {
    id: menuId,
    title: "QA Menu 84-4",
    description: "Cooking measurement verification",
    category_id: "cat-1",
    category_name: "Main",
    photo_url: null,
    available_stock: 10,
    sell_price: 25000,
    recipe_yield: 1,
    margin_percent: 0,
    vat_percent: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
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
              id: "user-manager-84-4",
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

    if (pathname.includes("/api/v1/users/user-manager-84-4") && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: {
            id: "user-manager-84-4",
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

    if (pathname === `/api/admin/menus/${menuId}` && method === "GET") {
      return route.fulfill(json({ success: true, data: buildMenu() }));
    }

    if (pathname === `/api/admin/menus/${menuId}/ingredients` && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: {
            menu_id: menuId,
            ingredients: state.ingredients,
          },
        }),
      );
    }

    if (pathname === `/api/admin/menus/${menuId}/ingredients` && method === "PUT") {
      const payload = request.postDataJSON();
      state.ingredients = (payload.ingredients ?? []).map((ingredient) => {
        const supply =
          ingredient.food_supply_id === riceSupplyId
            ? state.supplies[riceSupplyId]
            : state.supplies[saltSupplyId];
        const cookingMeasurement = supply.cooking_measurements.find(
          (item) => item.id === ingredient.cooking_measurement_id,
        );
        const conversion = cookingMeasurement
          ? Number(cookingMeasurement.conversion_quantity)
          : null;
        const quantityPerUnit =
          cookingMeasurement && conversion
            ? ingredient.quantity_per_unit * conversion
            : ingredient.quantity_per_unit;

        return {
          food_supply_id: ingredient.food_supply_id,
          quantity_per_unit: String(quantityPerUnit),
          entry_quantity:
            cookingMeasurement != null
              ? String(ingredient.quantity_per_unit)
              : undefined,
          cooking_measurement_id: ingredient.cooking_measurement_id ?? null,
          cooking_measurement_name: cookingMeasurement?.name ?? null,
          food_supply_title: supply.title,
          food_supply_unit: supply.unit,
          food_supply_stock_quantity: supply.stock_quantity,
        };
      });
      return route.fulfill(
        json({
          success: true,
          data: {
            menu_id: menuId,
            ingredients: state.ingredients,
          },
        }),
      );
    }

    if (pathname === `/api/admin/food-supplies/${riceSupplyId}` && method === "GET") {
      return route.fulfill(
        json({ success: true, data: state.supplies[riceSupplyId] }),
      );
    }

    if (pathname === `/api/admin/food-supplies/${saltSupplyId}` && method === "GET") {
      return route.fulfill(
        json({ success: true, data: state.supplies[saltSupplyId] }),
      );
    }

    if (pathname === "/api/admin/food-supplies" && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: [state.supplies[riceSupplyId], state.supplies[saltSupplyId]],
        }),
      );
    }

    if (pathname === "/api/admin/cogs" && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: [
            {
              menu_id: menuId,
              title: "QA Menu 84-4",
              category_id: "cat-1",
              category_name: "Main",
              cogs_per_piece: "1200",
              margin_percent: "0",
              vat_percent: "0",
              price_after_margin: "1200",
              price_after_vat: "1200",
              recommended_offline: "15000",
              recommended_online: "16000",
              sell_price: "25000",
              status: "complete",
            },
          ],
          meta: { total: 1, page: 1, per_page: 10 },
        }),
      );
    }

    if (pathname === "/api/admin/categories" && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: [{ id: "cat-1", name: "Main", created_at: "", updated_at: "" }],
          meta: { total: 1, page: 1, per_page: 100 },
        }),
      );
    }

    if (pathname === `/api/admin/cogs/${menuId}` && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: {
            menu_id: menuId,
            title: "QA Menu 84-4",
            category_id: "cat-1",
            category_name: "Main",
            sell_price: 25000,
            recipe_yield: 1,
            cogs_per_piece: 1200,
            margin_percent: 0,
            vat_percent: 0,
            status: "complete",
            total_cogs: 1200,
            ingredients: state.ingredients.map((ingredient) => ({
              food_supply_id: ingredient.food_supply_id,
              food_supply_title: ingredient.food_supply_title,
              quantity_batch: ingredient.quantity_per_unit,
              quantity_per_piece: ingredient.quantity_per_unit,
              unit: ingredient.food_supply_unit,
              selected_supplier_id: null,
              selected_supplier_name: null,
              selected_unit_price: 100,
              supplier_quotes: [],
              line_cost: Number(ingredient.quantity_per_unit) * 100,
            })),
          },
        }),
      );
    }

    if (pathname.includes("/stock-estimation")) {
      return route.fulfill(
        json({
          success: true,
          data: {
            has_formula: state.ingredients.length > 0,
            requested_quantity: 1,
            is_fully_producible: true,
          },
        }),
      );
    }

    return route.continue();
  });
}

async function login(page) {
  await page.goto(`${WEB_BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', MANAGER_EMAIL);
  await page.fill('input[type="password"]', MANAGER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(
    (url) => url.pathname.startsWith("/admin") && !url.pathname.includes("/admin/login"),
    { timeout: 15000 },
  );
}

async function openIngredientsPage(page) {
  await page.goto(`${WEB_BASE}/admin/menus/${menuId}/ingredients`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("heading", { name: "Ingredients", exact: true }).waitFor({
    timeout: 15000,
  });
}

async function selectSupply(page, ingredientLabel, supplyTitle) {
  await page.getByRole("button", { name: ingredientLabel, exact: true }).click();
  await page.getByPlaceholder("Search food supplies").fill(supplyTitle);
  await page.getByRole("option", { name: new RegExp(supplyTitle) }).click();
}

async function main() {
  const state = {
    ingredients: [
      {
        food_supply_id: riceSupplyId,
        quantity_per_unit: "200",
        food_supply_title: "Rice",
        food_supply_unit: "gr",
        food_supply_stock_quantity: "1000",
      },
    ],
    supplies: {
      [riceSupplyId]: buildFoodSupply(riceSupplyId, "Rice", "gr"),
      [saltSupplyId]: buildFoodSupply(saltSupplyId, "Salt", "gr", [
        { id: tbspId, name: "Tablespoon", conversion_quantity: "10" },
      ]),
    },
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await installApiMocks(page, state);
  await login(page);
  await openIngredientsPage(page);

  // 5. Regression base-only ingredient display
  await page.getByLabel("Quantity per unit").first().waitFor();
  const baseQuantity = await page.getByLabel("Quantity per unit").first().inputValue();
  if (baseQuantity !== "200") {
    throw new Error(`Expected base-only quantity 200, got ${baseQuantity}`);
  }
  if (await page.getByText("gr").count() === 0) {
    throw new Error("Expected base unit label gr for rice");
  }
  console.log("PASS: Regression base-only ingredient display");

  // 1. Enter ingredient quantity in cooking measurement
  await page.getByRole("button", { name: "Add ingredient" }).click();
  await selectSupply(page, "Ingredient 2", "Salt");
  await page.getByLabel("Unit for ingredient 2").selectOption(tbspId);
  await page.getByLabel("Quantity per unit").nth(1).fill("0.5");
  if (!(await page.getByText("= 5 gr").isVisible())) {
    throw new Error("Expected base quantity hint = 5 gr");
  }
  await page.getByRole("button", { name: "Save ingredients" }).click();
  await page.waitForTimeout(500);

  await page.reload({ waitUntil: "networkidle" });
  await page.getByLabel("Quantity per unit").nth(1).waitFor();
  const reloadedCookingQty = await page
    .getByLabel("Quantity per unit")
    .nth(1)
    .inputValue();
  const reloadedUnit = await page.getByLabel("Unit for ingredient 2").inputValue();
  if (reloadedCookingQty !== "0.5" || reloadedUnit !== tbspId) {
    throw new Error(
      `Expected 0.5 Tablespoon on reload, got ${reloadedCookingQty} / ${reloadedUnit}`,
    );
  }
  console.log("PASS: Enter ingredient quantity in cooking measurement");

  // 2. Mixed base and cooking units in one formula
  const riceQty = await page.getByLabel("Quantity per unit").first().inputValue();
  if (riceQty !== "200") {
    throw new Error(`Expected rice line to remain 200 gr, got ${riceQty}`);
  }
  console.log("PASS: Mixed base and cooking units in one formula");

  // 3. Switch from cooking unit to base unit
  await page.getByLabel("Unit for ingredient 2").selectOption("base");
  await page.getByLabel("Quantity per unit").nth(1).fill("5");
  await page.getByRole("button", { name: "Save ingredients" }).click();
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "networkidle" });
  const switchedQty = await page.getByLabel("Quantity per unit").nth(1).inputValue();
  if (switchedQty !== "5") {
    throw new Error(`Expected switched base quantity 5, got ${switchedQty}`);
  }
  if (await page.getByLabel("Unit for ingredient 2").count() > 0) {
    const switchedUnit = await page.getByLabel("Unit for ingredient 2").inputValue();
    if (switchedUnit !== "base") {
      throw new Error(`Expected base unit selected, got ${switchedUnit}`);
    }
  }
  const savedSalt = state.ingredients.find(
    (item) => item.food_supply_id === saltSupplyId,
  );
  if (savedSalt?.cooking_measurement_id) {
    throw new Error("Expected no cooking_measurement_id after switching to base");
  }
  console.log("PASS: Switch from cooking unit to base unit");

  // 4. COGS page loads after cooking-measurement formula
  state.ingredients = [
    {
      food_supply_id: saltSupplyId,
      quantity_per_unit: "5",
      entry_quantity: "0.5",
      cooking_measurement_id: tbspId,
      cooking_measurement_name: "Tablespoon",
      food_supply_title: "Salt",
      food_supply_unit: "gr",
      food_supply_stock_quantity: "1000",
    },
  ];
  await page.goto(`${WEB_BASE}/admin/cogs`, { waitUntil: "networkidle" });
  await page.getByRole("cell", { name: "QA Menu 84-4" }).click();
  await page.getByText("COGS / piece").waitFor({ timeout: 10000 });
  await page.getByText("5 gr").waitFor({ timeout: 10000 });
  console.log("PASS: COGS page loads after cooking-measurement formula");

  await browser.close();
  console.log("All POS-84-4 browser checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
