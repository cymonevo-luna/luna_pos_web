import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminMenusPage from "./page";
import { menusAdminApi } from "@/lib/api/menus";
import { categoriesAdminApi } from "@/lib/api/categories";
import { ApiError } from "@/lib/api/client";
import type { Category, Menu } from "@/lib/api/types";
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

vi.mock("@/lib/api/menus", () => ({
  menusAdminApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  menuFormToPayload: vi.fn((values) => ({
    title: values.title.trim(),
    category_id: values.category_id,
    available_stock: values.available_stock,
    sell_price: values.sell_price,
    recipe_yield: values.recipe_yield,
    margin_percent: values.margin_percent,
    vat_percent: values.vat_percent,
    ...(values.description?.trim()
      ? { description: values.description.trim() }
      : {}),
    ...(values.photo_url?.trim() ? { photo_url: values.photo_url.trim() } : {}),
  })),
}));

vi.mock("@/lib/api/categories", () => ({
  categoriesAdminApi: {
    list: vi.fn(),
  },
}));

vi.mock("@/components/admin/menu-ingredients-form", () => ({
  MenuIngredientsForm: ({ menuId }: { menuId: string }) => (
    <section aria-label="Menu ingredients">
      <h4>Ingredients</h4>
      <button type="button">Add ingredient</button>
      <button type="button">Save ingredients</button>
      <span>menu:{menuId}</span>
    </section>
  ),
}));

vi.mock("@/components/admin/menu-stock-estimation-panel", () => ({
  MenuStockEstimationPanel: ({ menuId }: { menuId: string }) => (
    <section aria-label="Stock estimation">
      <h4>Stock Estimation</h4>
      <span>estimation:{menuId}</span>
    </section>
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const category: Category = {
  id: "cat-1",
  name: "Main",
  priority: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const menu: Menu = {
  id: "menu-1",
  title: "Nasi Goreng",
  description: "Spicy fried rice",
  category_id: "cat-1",
  category_name: "Main",
  photo_url: null,
  available_stock: 10,
  sell_price: 25000,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

describe("AdminMenusPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(categoriesAdminApi.list).mockResolvedValue({
      data: [category],
      meta: { page: 1, per_page: 100, total: 1 },
    });
    vi.mocked(menusAdminApi.list).mockResolvedValue({
      data: [menu],
      meta: { page: 1, per_page: 10, total: 1 },
    });
  });

  it("renders menus from the API with Rupiah price", async () => {
    render(<AdminMenusPage />);

    expect(await screen.findByText("Nasi Goreng")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByText("Rp 25.000")).toBeInTheDocument();
    expect(screen.getByText("1 total")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Menu" })).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
    expect(screen.getByText("Stock")).toBeInTheDocument();
    expect(screen.getByText("Price")).toBeInTheDocument();
  });

  it("shows empty state when no menus match", async () => {
    vi.mocked(menusAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 10, total: 0 },
    });

    render(<AdminMenusPage />);

    expect(await screen.findByText("No menus found.")).toBeInTheDocument();
  });

  it("disables add menu when no categories exist", async () => {
    vi.mocked(categoriesAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 100, total: 0 },
    });

    render(<AdminMenusPage />);

    expect(
      await screen.findByText(/Create a category before adding menu items/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Menu" })).toBeDisabled();
  });

  it("debounces search and reloads with the search term", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<AdminMenusPage />);
    await screen.findByText("Nasi Goreng");

    await user.type(screen.getByPlaceholderText("Search by title"), "Nasi");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(menusAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        search: "Nasi",
        categoryId: "",
      });
    });

    vi.useRealTimers();
  });

  it("filters menus by category", async () => {
    const user = userEvent.setup();

    render(<AdminMenusPage />);
    await screen.findByText("Nasi Goreng");

    await user.selectOptions(
      screen.getByLabelText("Filter by category"),
      "cat-1",
    );

    await waitFor(() => {
      expect(menusAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        search: "",
        categoryId: "cat-1",
      });
    });
  });

  it("deletes a menu after confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(menusAdminApi.delete).mockResolvedValue({
      data: undefined,
    });

    render(<AdminMenusPage />);
    await screen.findByText("Nasi Goreng");

    await user.click(screen.getByLabelText("Delete menu"));
    expect(screen.getByText("Delete menu")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(menusAdminApi.delete).toHaveBeenCalledWith("menu-1");
    });
    expect(toast.success).toHaveBeenCalledWith("Menu deleted");
  });

  it("creates a menu from the dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(menusAdminApi.create).mockResolvedValue({
      data: {
        ...menu,
        id: "menu-2",
        title: "Mie Goreng",
        sell_price: 30000,
      },
    });

    render(<AdminMenusPage />);
    await screen.findByText("Nasi Goreng");

    await user.click(screen.getByRole("button", { name: "Add Menu" }));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText("Title"), "Mie Goreng");
    await user.selectOptions(within(dialog).getByLabelText("Category"), "cat-1");
    await user.clear(within(dialog).getByLabelText("Available stock"));
    await user.type(within(dialog).getByLabelText("Available stock"), "10");
    await user.clear(within(dialog).getByLabelText("Sell price (Rp)"));
    await user.type(within(dialog).getByLabelText("Sell price (Rp)"), "25000");
    await user.click(within(dialog).getByRole("button", { name: "Add Menu" }));

    await waitFor(() => {
      expect(menusAdminApi.create).toHaveBeenCalledWith({
        title: "Mie Goreng",
        category_id: "cat-1",
        available_stock: 10,
        sell_price: 25000,
        recipe_yield: 1,
        margin_percent: 0,
        vat_percent: 0,
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Menu created");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("edits a menu from the dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(menusAdminApi.update).mockResolvedValue({
      data: {
        ...menu,
        available_stock: 20,
        sell_price: 30000,
      },
    });

    render(<AdminMenusPage />);
    await screen.findByText("Nasi Goreng");

    await user.click(screen.getByLabelText("Edit menu"));
    expect(screen.getByText("Edit menu")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Available stock"));
    await user.type(screen.getByLabelText("Available stock"), "20");
    await user.clear(screen.getByLabelText("Sell price (Rp)"));
    await user.type(screen.getByLabelText("Sell price (Rp)"), "30000");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(menusAdminApi.update).toHaveBeenCalledWith("menu-1", {
        title: "Nasi Goreng",
        description: "Spicy fried rice",
        category_id: "cat-1",
        available_stock: 20,
        sell_price: 30000,
        recipe_yield: 1,
        margin_percent: 0,
        vat_percent: 0,
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Menu updated");
  });

  it("maps server validation errors onto form fields", async () => {
    const user = userEvent.setup();
    vi.mocked(menusAdminApi.create).mockRejectedValue(
      new ApiError(422, "validation_error", "Validation failed", {
        title: "Title is required",
      }),
    );

    render(<AdminMenusPage />);
    await screen.findByText("Nasi Goreng");

    await user.click(screen.getByRole("button", { name: "Add Menu" }));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText("Title"), " ");
    await user.selectOptions(within(dialog).getByLabelText("Category"), "cat-1");
    await user.clear(within(dialog).getByLabelText("Available stock"));
    await user.type(within(dialog).getByLabelText("Available stock"), "10");
    await user.clear(within(dialog).getByLabelText("Sell price (Rp)"));
    await user.type(within(dialog).getByLabelText("Sell price (Rp)"), "25000");
    await user.click(within(dialog).getByRole("button", { name: "Add Menu" }));

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows COGS fields in the create dialog", async () => {
    const user = userEvent.setup();

    render(<AdminMenusPage />);
    await screen.findByText("Nasi Goreng");

    await user.click(screen.getByRole("button", { name: "Add Menu" }));
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByLabelText("Recipe yield")).toHaveValue(1);
    expect(within(dialog).getByLabelText("Margin %")).toHaveValue(0);
    expect(within(dialog).getByLabelText("VAT %")).toHaveValue(0);
    expect(
      within(dialog).getByText(
        "Number of portions produced by the ingredient quantities below",
      ),
    ).toBeInTheDocument();
  });

  it("saves menu with custom COGS values and reloads them on edit", async () => {
    const user = userEvent.setup();
    const savedMenu: Menu = {
      ...menu,
      id: "menu-2",
      title: "Batch Soup",
      recipe_yield: 40,
      margin_percent: 30,
      vat_percent: 11,
    };

    vi.mocked(menusAdminApi.create).mockResolvedValue({ data: savedMenu });
    vi.mocked(menusAdminApi.list).mockResolvedValue({
      data: [savedMenu],
      meta: { page: 1, per_page: 10, total: 1 },
    });

    render(<AdminMenusPage />);
    await screen.findByText("Batch Soup");

    await user.click(screen.getByRole("button", { name: "Add Menu" }));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText("Title"), "Batch Soup");
    await user.selectOptions(within(dialog).getByLabelText("Category"), "cat-1");
    await user.clear(within(dialog).getByLabelText("Available stock"));
    await user.type(within(dialog).getByLabelText("Available stock"), "10");
    await user.clear(within(dialog).getByLabelText("Sell price (Rp)"));
    await user.type(within(dialog).getByLabelText("Sell price (Rp)"), "25000");
    await user.clear(within(dialog).getByLabelText("Recipe yield"));
    await user.type(within(dialog).getByLabelText("Recipe yield"), "40");
    await user.clear(within(dialog).getByLabelText("Margin %"));
    await user.type(within(dialog).getByLabelText("Margin %"), "30");
    await user.clear(within(dialog).getByLabelText("VAT %"));
    await user.type(within(dialog).getByLabelText("VAT %"), "11");
    await user.click(within(dialog).getByRole("button", { name: "Add Menu" }));

    await waitFor(() => {
      expect(menusAdminApi.create).toHaveBeenCalledWith({
        title: "Batch Soup",
        category_id: "cat-1",
        available_stock: 10,
        sell_price: 25000,
        recipe_yield: 40,
        margin_percent: 30,
        vat_percent: 11,
      });
    });

    await user.click(screen.getByLabelText("Edit menu"));

    expect(screen.getByLabelText("Recipe yield")).toHaveValue(40);
    expect(screen.getByLabelText("Margin %")).toHaveValue(30);
    expect(screen.getByLabelText("VAT %")).toHaveValue(11);
  });

  it("blocks recipe yield of zero before submitting", async () => {
    const user = userEvent.setup();

    render(<AdminMenusPage />);
    await screen.findByText("Nasi Goreng");

    await user.click(screen.getByRole("button", { name: "Add Menu" }));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText("Title"), "Invalid Yield");
    await user.selectOptions(within(dialog).getByLabelText("Category"), "cat-1");
    await user.clear(within(dialog).getByLabelText("Available stock"));
    await user.type(within(dialog).getByLabelText("Available stock"), "10");
    await user.clear(within(dialog).getByLabelText("Sell price (Rp)"));
    await user.type(within(dialog).getByLabelText("Sell price (Rp)"), "25000");
    fireEvent.change(within(dialog).getByLabelText("Recipe yield"), {
      target: { value: "0" },
    });
    await user.click(within(dialog).getByRole("button", { name: "Add Menu" }));

    expect(
      await within(dialog).findByText("Recipe yield must be at least 1"),
    ).toBeInTheDocument();
    expect(menusAdminApi.create).not.toHaveBeenCalled();
  });

  it("closes the dialog on cancel without saving", async () => {
    const user = userEvent.setup();

    render(<AdminMenusPage />);
    await screen.findByText("Nasi Goreng");

    await user.click(screen.getByRole("button", { name: "Add Menu" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Title"), "Satay");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(menusAdminApi.create).not.toHaveBeenCalled();
  });

  it("shows ingredients section when editing an existing menu", async () => {
    const user = userEvent.setup();

    render(<AdminMenusPage />);
    await screen.findByText("Nasi Goreng");

    await user.click(screen.getByLabelText("Edit menu"));

    expect(screen.getByRole("region", { name: "Menu ingredients" })).toBeInTheDocument();
    expect(screen.getByText("menu:menu-1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add ingredient" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save ingredients" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Stock estimation" })).toBeInTheDocument();
    expect(screen.getByText("estimation:menu-1")).toBeInTheDocument();
  });

  it("shows helper text on create instead of ingredients editor", async () => {
    const user = userEvent.setup();

    render(<AdminMenusPage />);
    await screen.findByText("Nasi Goreng");

    await user.click(screen.getByRole("button", { name: "Add Menu" }));

    expect(
      screen.getByText("Save the menu first to add an ingredient formula."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Menu ingredients" }),
    ).not.toBeInTheDocument();
  });
});
