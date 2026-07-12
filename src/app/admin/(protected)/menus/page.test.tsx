import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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
  menuBasicFormToPayload: vi.fn((basic) => ({
    title: basic.title.trim(),
    category_id: basic.category_id,
    available_stock: basic.available_stock,
    sell_price: basic.sell_price,
    ...(basic.description?.trim()
      ? { description: basic.description.trim() }
      : {}),
    ...(basic.photo_url?.trim() ? { photo_url: basic.photo_url.trim() } : {}),
  })),
  menuFullFormToPayload: vi.fn((basic, cogs) => ({
    title: basic.title.trim(),
    category_id: basic.category_id,
    available_stock: basic.available_stock,
    sell_price: basic.sell_price,
    recipe_yield: cogs.recipe_yield,
    margin_percent: cogs.margin_percent,
    vat_percent: cogs.vat_percent,
    ...(basic.description?.trim()
      ? { description: basic.description.trim() }
      : {}),
    ...(basic.photo_url?.trim() ? { photo_url: basic.photo_url.trim() } : {}),
  })),
}));

vi.mock("@/lib/api/categories", () => ({
  categoriesAdminApi: {
    list: vi.fn(),
  },
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

  it("does not show COGS fields in the create dialog", async () => {
    const user = userEvent.setup();

    render(<AdminMenusPage />);
    await screen.findByText("Nasi Goreng");

    await user.click(screen.getByRole("button", { name: "Add Menu" }));
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).queryByLabelText("Recipe yield")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Margin %")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("VAT %")).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText("COGS configuration"),
    ).not.toBeInTheDocument();
  });

  it("creates a menu with COGS defaults even without COGS inputs", async () => {
    const user = userEvent.setup();
    const savedMenu: Menu = {
      ...menu,
      id: "menu-2",
      title: "Batch Soup",
      recipe_yield: 1,
      margin_percent: 0,
      vat_percent: 0,
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
    await user.click(within(dialog).getByRole("button", { name: "Add Menu" }));

    await waitFor(() => {
      expect(menusAdminApi.create).toHaveBeenCalledWith({
        title: "Batch Soup",
        category_id: "cat-1",
        available_stock: 10,
        sell_price: 25000,
        recipe_yield: 1,
        margin_percent: 0,
        vat_percent: 0,
      });
    });
  });

  it("preserves existing COGS values when editing basic fields", async () => {
    const user = userEvent.setup();
    const menuWithCogs: Menu = {
      ...menu,
      recipe_yield: 40,
      margin_percent: 30,
      vat_percent: 11,
    };

    vi.mocked(menusAdminApi.list).mockResolvedValue({
      data: [menuWithCogs],
      meta: { page: 1, per_page: 10, total: 1 },
    });
    vi.mocked(menusAdminApi.update).mockResolvedValue({
      data: {
        ...menuWithCogs,
        available_stock: 20,
        sell_price: 30000,
      },
    });

    render(<AdminMenusPage />);
    await screen.findByText("Nasi Goreng");

    await user.click(screen.getByLabelText("Edit menu"));
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
        recipe_yield: 40,
        margin_percent: 30,
        vat_percent: 11,
      });
    });
  });

  it("applies scroll and max-height classes to the create dialog", async () => {
    const user = userEvent.setup();

    render(<AdminMenusPage />);
    await screen.findByText("Nasi Goreng");

    await user.click(screen.getByRole("button", { name: "Add Menu" }));
    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveClass("max-h-[90vh]");
    expect(dialog).toHaveClass("overflow-y-auto");
    expect(dialog).toHaveClass("max-w-xl");
  });

  it("applies scroll and max-height classes to the edit dialog", async () => {
    const user = userEvent.setup();

    render(<AdminMenusPage />);
    await screen.findByText("Nasi Goreng");

    await user.click(screen.getByLabelText("Edit menu"));
    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveClass("max-h-[90vh]");
    expect(dialog).toHaveClass("overflow-y-auto");
    expect(dialog).toHaveClass("max-w-xl");
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

  it("navigates to ingredients page from manage ingredients action", async () => {
    render(<AdminMenusPage />);
    await screen.findByText("Nasi Goreng");

    const manageLink = screen.getByLabelText("Manage ingredients");
    expect(manageLink).toHaveAttribute(
      "href",
      "/admin/menus/menu-1/ingredients",
    );
  });

  it("does not show ingredients or stock sections in edit dialog", async () => {
    const user = userEvent.setup();

    render(<AdminMenusPage />);
    await screen.findByText("Nasi Goreng");

    await user.click(screen.getByLabelText("Edit menu"));

    expect(
      screen.queryByRole("region", { name: "Menu ingredients" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Stock estimation" }),
    ).not.toBeInTheDocument();
  });

  it("shows helper text on create instead of ingredients editor", async () => {
    const user = userEvent.setup();

    render(<AdminMenusPage />);
    await screen.findByText("Nasi Goreng");

    await user.click(screen.getByRole("button", { name: "Add Menu" }));

    expect(
      screen.getByText(
        "After saving, use Manage ingredients in the menu list to configure the formula.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Menu ingredients" }),
    ).not.toBeInTheDocument();
  });
});
