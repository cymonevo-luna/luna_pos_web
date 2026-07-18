#!/usr/bin/env node
/**
 * Browser verification for POS-112-3: menu reference ingredients in admin form.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8087";
const MANAGER_EMAIL =
  process.env.TEST_MANAGER_EMAIL ?? "manager-test@cymonevo.com";
const MANAGER_PASSWORD =
  process.env.TEST_MANAGER_PASSWORD ?? "LunaTesting123!";

const menuSambalId = "menu-sambal-merah";
const menuDendengId = "menu-dendeng-balado";
const menuCycleAId = "menu-cycle-a";
const menuCycleBId = "menu-cycle-b";
const menuRegressionId = "menu-regression";

const supplyCabeId = "fs-cabe";
const supplyMinyakId = "fs-minyak";
const supplyDagingId = "fs-daging";
const supplyFlourId = "fs-flour";

function makeJwt(claims = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url",
  );
  const body = Buffer.from(
    JSON.stringify({
      uid: "user-manager-112-3",
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

function buildFoodSupply(id, title, unit) {
  return {
    id,
    title,
    description: null,
    stock_quantity: "10000",
    unit,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    manual_edit_history: [],
    cooking_measurements: [],
  };
}

function buildMenu(id, title) {
  return {
    id,
    title,
    description: null,
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

function normalizeIngredientPayload(ingredient, state) {
  if (ingredient.ingredient_menu_id) {
    const menu = state.menus[ingredient.ingredient_menu_id];
    return {
      ingredient_menu_id: ingredient.ingredient_menu_id,
      ingredient_menu_title: menu?.title ?? ingredient.ingredient_menu_id,
      quantity_per_unit: String(ingredient.quantity_per_unit),
    };
  }

  const supply = state.supplies[ingredient.food_supply_id];
  return {
    food_supply_id: ingredient.food_supply_id,
    quantity_per_unit: String(ingredient.quantity_per_unit),
    food_supply_title: supply?.title ?? ingredient.food_supply_id,
    food_supply_unit: supply?.unit ?? "gr",
    food_supply_stock_quantity: supply?.stock_quantity ?? "0",
  };
}

function detectCircularReference(menuId, ingredients, state, visiting = new Set()) {
  if (visiting.has(menuId)) {
    return true;
  }
  visiting.add(menuId);

  for (const ingredient of ingredients) {
    if (!ingredient.ingredient_menu_id) continue;
    const nested = state.formulas[ingredient.ingredient_menu_id] ?? [];
    if (detectCircularReference(ingredient.ingredient_menu_id, nested, state, visiting)) {
      return true;
    }
  }

  visiting.delete(menuId);
  return false;
}

function flattenLeaves(menuId, multiplier, state, visiting = new Set()) {
  if (visiting.has(menuId)) {
    return [];
  }
  visiting.add(menuId);

  const ingredients = state.formulas[menuId] ?? [];
  const leaves = [];

  for (const ingredient of ingredients) {
    if (ingredient.ingredient_menu_id) {
      const nestedMultiplier =
        multiplier * Number(ingredient.quantity_per_unit);
      leaves.push(
        ...flattenLeaves(
          ingredient.ingredient_menu_id,
          nestedMultiplier,
          state,
          visiting,
        ),
      );
      continue;
    }

    const supply = state.supplies[ingredient.food_supply_id];
    leaves.push({
      food_supply_title: supply?.title ?? ingredient.food_supply_title,
      unit: supply?.unit ?? ingredient.food_supply_unit,
      quantity_per_unit: Number(ingredient.quantity_per_unit),
      required_quantity:
        multiplier * Number(ingredient.quantity_per_unit),
      current_stock_quantity: Number(supply?.stock_quantity ?? 0),
      remaining_after:
        Number(supply?.stock_quantity ?? 0) -
        multiplier * Number(ingredient.quantity_per_unit),
      is_sufficient:
        Number(supply?.stock_quantity ?? 0) >=
        multiplier * Number(ingredient.quantity_per_unit),
    });
  }

  visiting.delete(menuId);
  return leaves;
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
              id: "user-manager-112-3",
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

    if (
      pathname.includes("/api/v1/users/user-manager-112-3") &&
      method === "GET"
    ) {
      return route.fulfill(
        json({
          success: true,
          data: {
            id: "user-manager-112-3",
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

    const menuMatch = pathname.match(/^\/api\/admin\/menus\/([^/]+)$/);
    if (menuMatch && method === "GET") {
      const menuId = menuMatch[1];
      const menu = state.menus[menuId];
      if (!menu) {
        return route.fulfill(
          json({ success: false, message: "Not found" }, 404),
        );
      }
      return route.fulfill(json({ success: true, data: menu }));
    }

    const ingredientsMatch = pathname.match(
      /^\/api\/admin\/menus\/([^/]+)\/ingredients$/,
    );
    if (ingredientsMatch && method === "GET") {
      const menuId = ingredientsMatch[1];
      return route.fulfill(
        json({
          success: true,
          data: {
            menu_id: menuId,
            ingredients: state.formulas[menuId] ?? [],
          },
        }),
      );
    }

    if (ingredientsMatch && method === "PUT") {
      const menuId = ingredientsMatch[1];
      const payload = request.postDataJSON();
      const ingredients = payload.ingredients ?? [];

      if (detectCircularReference(menuId, ingredients, state)) {
        return route.fulfill(
          json(
            {
              success: false,
              error: {
                code: "validation_error",
                message: "Validation failed",
                fields: {
                  "ingredients[0].ingredient_menu_id":
                    "Circular reference detected in menu ingredients",
                },
              },
            },
            422,
          ),
        );
      }

      state.formulas[menuId] = ingredients.map((ingredient) =>
        normalizeIngredientPayload(ingredient, state),
      );
      return route.fulfill(
        json({
          success: true,
          data: {
            menu_id: menuId,
            ingredients: state.formulas[menuId],
          },
        }),
      );
    }

    const stockMatch = pathname.match(
      /^\/api\/admin\/menus\/([^/]+)\/stock-estimation$/,
    );
    if (stockMatch && method === "GET") {
      const menuId = stockMatch[1];
      const quantity = Number(url.searchParams.get("quantity") ?? "1");
      const formula = state.formulas[menuId] ?? [];
      if (formula.length === 0) {
        return route.fulfill(
          json({
            success: true,
            data: {
              has_formula: false,
              requested_quantity: quantity,
              message:
                "No ingredient formula saved for this menu. Add and save ingredients first.",
            },
          }),
        );
      }

      const leaves = flattenLeaves(menuId, quantity, state);
      return route.fulfill(
        json({
          success: true,
          data: {
            has_formula: true,
            requested_quantity: quantity,
            is_fully_producible: leaves.every((leaf) => leaf.is_sufficient),
            ingredients: leaves,
          },
        }),
      );
    }

    if (pathname === "/api/admin/food-supplies" && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: Object.values(state.supplies),
        }),
      );
    }

    const supplyMatch = pathname.match(/^\/api\/admin\/food-supplies\/([^/]+)$/);
    if (supplyMatch && method === "GET") {
      const supply = state.supplies[supplyMatch[1]];
      if (!supply) {
        return route.fulfill(
          json({ success: false, message: "Not found" }, 404),
        );
      }
      return route.fulfill(json({ success: true, data: supply }));
    }

    if (pathname === "/api/admin/menus" && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: Object.values(state.menus),
          meta: {
            total: Object.keys(state.menus).length,
            page: 1,
            per_page: 20,
          },
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

    if (pathname === "/api/admin/cogs" && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: [],
          meta: { total: 0, page: 1, per_page: 10 },
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
    (url) =>
      url.pathname.startsWith("/admin") && !url.pathname.includes("/admin/login"),
    { timeout: 15000 },
  );
}

async function openIngredientsPage(page, menuId) {
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

async function selectMenu(page, ingredientLabel, menuTitle) {
  await page.getByRole("button", { name: ingredientLabel, exact: true }).click();
  await page.getByPlaceholder("Search menus").fill(menuTitle);
  await page.getByRole("option", { name: new RegExp(menuTitle) }).click();
}

async function main() {
  const state = {
    menus: {
      [menuSambalId]: buildMenu(menuSambalId, "Sambal Merah"),
      [menuDendengId]: buildMenu(menuDendengId, "Dendeng Balado"),
      [menuCycleAId]: buildMenu(menuCycleAId, "Cycle A"),
      [menuCycleBId]: buildMenu(menuCycleBId, "Cycle B"),
      [menuRegressionId]: buildMenu(menuRegressionId, "Regression Menu"),
    },
    supplies: {
      [supplyCabeId]: buildFoodSupply(supplyCabeId, "Cabe", "gr"),
      [supplyMinyakId]: buildFoodSupply(supplyMinyakId, "Minyak", "ml"),
      [supplyDagingId]: buildFoodSupply(supplyDagingId, "Daging", "gr"),
      [supplyFlourId]: buildFoodSupply(supplyFlourId, "Flour", "gr"),
    },
    formulas: {
      [menuRegressionId]: [
        {
          food_supply_id: supplyFlourId,
          quantity_per_unit: "200",
          food_supply_title: "Flour",
          food_supply_unit: "gr",
          food_supply_stock_quantity: "10000",
        },
      ],
      [menuCycleBId]: [
        {
          ingredient_menu_id: menuCycleAId,
          ingredient_menu_title: "Cycle A",
          quantity_per_unit: "1",
        },
      ],
    },
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await installApiMocks(page, state);
  await login(page);

  // 1. Create nested formula via admin UI
  await openIngredientsPage(page, menuSambalId);
  await page.getByRole("button", { name: "Add food supply" }).click();
  await selectSupply(page, "Ingredient 1", "Cabe");
  await page.getByLabel("Quantity per unit").first().fill("100");
  await page.getByRole("button", { name: "Add food supply" }).click();
  await selectSupply(page, "Ingredient 2", "Minyak");
  await page.getByLabel("Quantity per unit").nth(1).fill("100");
  await page.getByRole("button", { name: "Save ingredients" }).click();
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByLabel("Quantity per unit").first().waitFor();
  if ((await page.getByLabel("Quantity per unit").first().inputValue()) !== "100") {
    throw new Error("Sambal Merah Cabe quantity did not persist");
  }
  if ((await page.getByLabel("Quantity per unit").nth(1).inputValue()) !== "100") {
    throw new Error("Sambal Merah Minyak quantity did not persist");
  }
  console.log("PASS: Sambal Merah food-supply formula saved");

  await openIngredientsPage(page, menuDendengId);
  await page.getByRole("button", { name: "Add food supply" }).click();
  await selectSupply(page, "Ingredient 1", "Daging");
  await page.getByLabel("Quantity per unit").first().fill("2000");
  await page.getByRole("button", { name: "Add menu reference" }).click();
  await selectMenu(page, "Ingredient 2", "Sambal Merah");
  await page.getByLabel("Quantity (portions)").fill("20");
  await page.getByRole("button", { name: "Save ingredients" }).click();
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByLabel("Quantity per unit").first().waitFor();
  if ((await page.getByLabel("Quantity per unit").first().inputValue()) !== "2000") {
    throw new Error("Dendeng Balado Daging quantity did not persist");
  }
  if ((await page.getByLabel("Quantity (portions)").inputValue()) !== "20") {
    throw new Error("Dendeng Balado menu reference quantity did not persist");
  }
  if (!(await page.getByText("Sambal Merah").first().isVisible())) {
    throw new Error("Dendeng Balado menu reference title not shown");
  }
  console.log("PASS: Create nested formula via admin UI");

  // 2. Menu reference row links to sub-menu
  const subRecipeLink = page.getByRole("link", { name: "Sambal Merah" });
  await subRecipeLink.click();
  await page.waitForURL(`**/admin/menus/${menuSambalId}/ingredients`);
  console.log("PASS: Menu reference row links to sub-menu");

  // 3. Stock estimation shows flattened leaves in UI
  await openIngredientsPage(page, menuDendengId);
  await page.getByLabel("Production quantity").fill("1");
  await page.getByRole("button", { name: "Estimate" }).click();
  await page.getByTestId("stock-estimation-results").waitFor();
  const tableText = await page.getByTestId("stock-estimation-results").innerText();
  for (const [title, qty] of [
    ["Daging", "2 kg"],
    ["Cabe", "2 kg"],
    ["Minyak", "2 ltr"],
  ]) {
    if (!tableText.includes(title) || !tableText.includes(qty)) {
      throw new Error(
        `Expected flattened stock row ${title} ${qty}, got: ${tableText}`,
      );
    }
  }
  if (tableText.includes("Sambal Merah")) {
    throw new Error("Stock estimation should not show menu reference row");
  }
  console.log("PASS: Stock estimation shows flattened leaves in UI");

  // 4. Circular reference error displayed
  await openIngredientsPage(page, menuCycleAId);
  await page.getByRole("button", { name: "Add menu reference" }).click();
  await selectMenu(page, "Ingredient 1", "Cycle B");
  await page.getByLabel("Quantity (portions)").fill("1");
  await page.getByRole("button", { name: "Save ingredients" }).click();
  await page.getByText("Circular reference detected in menu ingredients").waitFor({
    timeout: 5000,
  });
  console.log("PASS: Circular reference error displayed");

  // 5. Food-supply-only formula regression
  await openIngredientsPage(page, menuRegressionId);
  await page.getByLabel("Quantity per unit").first().waitFor();
  const regressionQty = await page.getByLabel("Quantity per unit").first().inputValue();
  if (regressionQty !== "200") {
    throw new Error(`Expected regression quantity 200, got ${regressionQty}`);
  }
  await page.getByRole("button", { name: "Add food supply" }).click();
  await selectSupply(page, "Ingredient 2", "Cabe");
  await page.getByLabel("Quantity per unit").nth(1).fill("50");
  await page.getByRole("button", { name: "Save ingredients" }).click();
  await page.waitForTimeout(500);
  await page.getByLabel("Production quantity").fill("1");
  await page.getByRole("button", { name: "Estimate" }).click();
  await page.getByTestId("stock-estimation-results").waitFor();
  console.log("PASS: Food-supply-only formula regression");

  await browser.close();
  console.log("All POS-112-3 browser checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
