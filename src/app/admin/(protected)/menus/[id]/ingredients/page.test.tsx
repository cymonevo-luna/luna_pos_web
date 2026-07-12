import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminMenuIngredientsContent } from "./menu-ingredients-content";
import { menusAdminApi } from "@/lib/api/menus";
import { cogsAdminApi } from "@/lib/api/cogs";
import { getMenuIngredients } from "@/lib/api/menu-ingredients";
import { ApiError } from "@/lib/api/client";
import type { CogsMenuDetail, Menu } from "@/lib/api/types";
import { toast } from "sonner";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/api/menus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/menus")>();
  return {
    ...actual,
    menusAdminApi: {
      get: vi.fn(),
      update: vi.fn(),
    },
  };
});

vi.mock("@/lib/api/cogs", () => ({
  cogsAdminApi: {
    get: vi.fn(),
  },
}));

vi.mock("@/lib/api/menu-ingredients", () => ({
  getMenuIngredients: vi.fn(),
  replaceMenuIngredients: vi.fn(),
}));

vi.mock("@/components/admin/food-supply-picker", () => ({
  FoodSupplyPicker: () => <div>Food supply picker</div>,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const menu: Menu = {
  id: "menu-1",
  title: "Nasi Goreng",
  description: "Spicy fried rice",
  category_id: "cat-1",
  category_name: "Main",
  photo_url: null,
  available_stock: 10,
  sell_price: 25000,
  recipe_yield: 1,
  margin_percent: 0,
  vat_percent: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

const cogsDetail: CogsMenuDetail = {
  menu_id: "menu-1",
  title: "Nasi Goreng",
  category_id: "cat-1",
  category_name: "Main",
  recipe_yield: 1,
  cogs_per_piece: 12000,
  margin_percent: 0,
  vat_percent: 0,
  price_after_margin: 12000,
  price_after_vat: 12000,
  recommended_offline: 15000,
  recommended_online: 18000,
  sell_price: 25000,
  status: "complete",
  total_cogs: 12000,
  ingredients: [
    {
      food_supply_id: "fs-1",
      food_supply_title: "Rice",
      quantity_batch: 200,
      quantity_per_piece: 200,
      unit: "gr",
      selected_supplier_id: "sup-1",
      selected_supplier_name: "Rice Supplier",
      selected_unit_price: 60,
      supplier_quotes: [
        {
          supplier_id: "sup-1",
          supplier_name: "Rice Supplier",
          unit_price: 60,
          selected: true,
        },
      ],
      line_cost: 12000,
    },
  ],
};

function renderPage(id = "menu-1") {
  return render(<AdminMenuIngredientsContent id={id} />);
}

describe("AdminMenuIngredientsContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(menusAdminApi.get).mockResolvedValue({ data: menu });
    vi.mocked(menusAdminApi.update).mockResolvedValue({ data: menu });
    vi.mocked(getMenuIngredients).mockResolvedValue({
      data: { menu_id: "menu-1", ingredients: [] },
    });
    vi.mocked(cogsAdminApi.get).mockResolvedValue({ data: cogsDetail });
  });

  it("renders all sections after menu load", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", {
        name: "Ingredients — Nasi Goreng",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "COGS settings" })).toBeInTheDocument();
    expect(screen.getByText("COGS configuration")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Menu ingredients" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Stock estimation" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "COGS breakdown" })).toBeInTheDocument();
    expect(await screen.findByText("Ingredient breakdown")).toBeInTheDocument();
    expect(screen.getByText("Rice")).toBeInTheDocument();
  });

  it("saves COGS settings with merged menu payload", async () => {
    const user = userEvent.setup();
    const updatedMenu: Menu = {
      ...menu,
      margin_percent: 25,
    };

    vi.mocked(menusAdminApi.update).mockResolvedValue({ data: updatedMenu });

    renderPage();
    await screen.findByRole("heading", {
      name: "Ingredients — Nasi Goreng",
    });

    await user.clear(screen.getByLabelText("Margin %"));
    await user.type(screen.getByLabelText("Margin %"), "25");
    await user.click(
      screen.getByRole("button", { name: "Save COGS settings" }),
    );

    await waitFor(() => {
      expect(menusAdminApi.update).toHaveBeenCalledWith("menu-1", {
        title: "Nasi Goreng",
        description: "Spicy fried rice",
        category_id: "cat-1",
        available_stock: 10,
        sell_price: 25000,
        recipe_yield: 1,
        margin_percent: 25,
        vat_percent: 0,
      });
    });
    expect(toast.success).toHaveBeenCalledWith("COGS settings saved");
  });

  it("saves COGS settings without photo_url when menu has default image", async () => {
    const user = userEvent.setup();
    const menuWithDefaultPhoto: Menu = {
      ...menu,
      photo_url: "/static/default-food.png",
    };

    vi.mocked(menusAdminApi.get).mockResolvedValue({ data: menuWithDefaultPhoto });
    vi.mocked(menusAdminApi.update).mockResolvedValue({
      data: { ...menuWithDefaultPhoto, margin_percent: 25 },
    });

    renderPage();
    await screen.findByRole("heading", {
      name: "Ingredients — Nasi Goreng",
    });

    await user.clear(screen.getByLabelText("Margin %"));
    await user.type(screen.getByLabelText("Margin %"), "25");
    await user.click(
      screen.getByRole("button", { name: "Save COGS settings" }),
    );

    await waitFor(() => {
      expect(menusAdminApi.update).toHaveBeenCalledWith("menu-1", {
        title: "Nasi Goreng",
        description: "Spicy fried rice",
        category_id: "cat-1",
        available_stock: 10,
        sell_price: 25000,
        recipe_yield: 1,
        margin_percent: 25,
        vat_percent: 0,
      });
    });
    const payload = vi.mocked(menusAdminApi.update).mock.calls[0]?.[1];
    expect(payload).not.toHaveProperty("photo_url");
    expect(toast.success).toHaveBeenCalledWith("COGS settings saved");
  });

  it("shows error state for invalid menu id", async () => {
    vi.mocked(menusAdminApi.get).mockRejectedValue(
      new ApiError(404, "not_found", "Menu not found"),
    );

    renderPage("bad-id");

    expect(await screen.findByText("Menu not found.")).toBeInTheDocument();
    const backLinks = screen.getAllByRole("link", { name: "Back to menus" });
    expect(backLinks.length).toBeGreaterThan(0);
    expect(backLinks[0]).toHaveAttribute("href", "/admin/menus");
    expect(screen.queryByText("COGS configuration")).not.toBeInTheDocument();
  });
});
