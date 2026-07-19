import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminCogsPage from "./page";
import { cogsAdminApi } from "@/lib/api/cogs";
import { categoriesAdminApi } from "@/lib/api/categories";
import { ApiError } from "@/lib/api/client";
import type { Category, CogsMenuDetail, CogsMenuSummary } from "@/lib/api/types";
import { toast } from "sonner";

vi.mock("@/lib/api/cogs", () => ({
  cogsAdminApi: {
    list: vi.fn(),
    get: vi.fn(),
    exportCsv: vi.fn(),
  },
  downloadCogsCsv: vi.fn(),
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

const rendangSummary: CogsMenuSummary = {
  menu_id: "menu-rendang",
  title: "Rendang",
  category_id: "cat-1",
  category_name: "Main",
  cogs_per_piece: 15000,
  margin_percent: 30,
  vat_percent: 10,
  price_after_margin: 19500,
  price_after_vat: 21450,
  recommended_offline: 22000,
  recommended_online: 26400,
  sell_price: 25000,
  status: "complete",
};

const missingPricesSummary: CogsMenuSummary = {
  menu_id: "menu-2",
  title: "Gado-gado",
  category_id: "cat-1",
  category_name: "Main",
  cogs_per_piece: null,
  margin_percent: 20,
  vat_percent: 11,
  price_after_margin: null,
  price_after_vat: null,
  recommended_offline: null,
  recommended_online: null,
  sell_price: 18000,
  status: "missing_prices",
};

const rendangDetail: CogsMenuDetail = {
  ...rendangSummary,
  recipe_yield: 10,
  total_cogs: 150000,
  ingredients: [
    {
      food_supply_id: "fs-1",
      food_supply_title: "Beef",
      quantity_batch: 1000,
      quantity_per_piece: 100,
      unit: "gr",
      selected_supplier_id: "sup-2",
      selected_supplier_name: "Premium Meats",
      selected_unit_price: 120000,
      supplier_quotes: [
        {
          supplier_id: "sup-1",
          supplier_name: "Local Market",
          unit_price: 100000,
          selected: false,
        },
        {
          supplier_id: "sup-2",
          supplier_name: "Premium Meats",
          unit_price: 120000,
          selected: true,
        },
      ],
      line_cost: 12000,
    },
  ],
};

describe("AdminCogsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(categoriesAdminApi.list).mockResolvedValue({
      data: [category],
      meta: { page: 1, per_page: 100, total: 1 },
    });
    vi.mocked(cogsAdminApi.list).mockResolvedValue({
      data: [rendangSummary, missingPricesSummary],
      meta: { page: 1, per_page: 10, total: 2 },
    });
    vi.mocked(cogsAdminApi.get).mockResolvedValue({ data: rendangDetail });
  });

  it("renders COGS dashboard list with expected columns and values", async () => {
    render(<AdminCogsPage />);

    expect(await screen.findByText("Rendang")).toBeInTheDocument();
    expect(screen.getByText("Rp 15.000")).toBeInTheDocument();
    expect(screen.getByText("Rp 22.000")).toBeInTheDocument();
    expect(screen.getByText("Rp 26.400")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.getByText("Missing prices")).toBeInTheDocument();
    expect(screen.getByText("COGS")).toBeInTheDocument();
    expect(screen.getByText("2 total")).toBeInTheDocument();
  });

  it("shows empty state when no menus match", async () => {
    vi.mocked(cogsAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 10, total: 0 },
    });

    render(<AdminCogsPage />);

    expect(await screen.findByText("No menus found.")).toBeInTheDocument();
  });

  it("filters menus by search query", async () => {
    const user = userEvent.setup();

    render(<AdminCogsPage />);
    await screen.findByText("Rendang");

    await user.type(screen.getByLabelText("Search menus"), "rendang");

    await waitFor(() => {
      expect(cogsAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        search: "rendang",
        categoryId: "",
      });
    });
  });

  it("opens detail dialog with ingredient breakdown on row click", async () => {
    const user = userEvent.setup();

    render(<AdminCogsPage />);
    await screen.findByText("Rendang");

    await user.click(screen.getByText("Rendang"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Rendang" })).toBeInTheDocument();
    expect(within(dialog).getByText("Beef")).toBeInTheDocument();
    expect(within(dialog).getByText(/Batch:/)).toHaveTextContent("1 kg");
    expect(within(dialog).getByText(/Selected supplier \(highest price\)/)).toBeInTheDocument();
    expect(within(dialog).getByText("Yes")).toBeInTheDocument();
    expect(cogsAdminApi.get).toHaveBeenCalledWith("menu-rendang");
  });

  it("exports CSV and shows success toast", async () => {
    const user = userEvent.setup();
    const { downloadCogsCsv } = await import("@/lib/api/cogs");
    const blob = new Blob(["menu,cogs"]);
    vi.mocked(cogsAdminApi.exportCsv).mockResolvedValue(blob);

    render(<AdminCogsPage />);
    await screen.findByText("Rendang");

    await user.click(screen.getByRole("button", { name: /Export CSV/i }));

    await waitFor(() => {
      expect(cogsAdminApi.exportCsv).toHaveBeenCalled();
      expect(downloadCogsCsv).toHaveBeenCalledWith(blob);
      expect(toast.success).toHaveBeenCalledWith("COGS CSV exported");
    });
  });

  it("shows error toast when export fails", async () => {
    const user = userEvent.setup();
    vi.mocked(cogsAdminApi.exportCsv).mockRejectedValue(
      new ApiError(500, "server_error", "Export failed"),
    );

    render(<AdminCogsPage />);
    await screen.findByText("Rendang");

    await user.click(screen.getByRole("button", { name: /Export CSV/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Export failed");
    });
  });

  it("shows error toast when loading fails", async () => {
    vi.mocked(cogsAdminApi.list).mockRejectedValue(
      new ApiError(500, "server_error", "Server error"),
    );

    render(<AdminCogsPage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Server error");
    });
  });

  it("renders four sortable column headers", async () => {
    render(<AdminCogsPage />);
    await screen.findByText("Rendang");

    expect(
      screen.getByRole("button", { name: "Sort by menu" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sort by margin %" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sort by current sell price" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sort by status" }),
    ).toBeInTheDocument();
  });

  it("sends menu_title sort on Menu header click", async () => {
    const user = userEvent.setup();

    render(<AdminCogsPage />);
    await screen.findByText("Rendang");

    await user.click(screen.getByRole("button", { name: "Sort by menu" }));

    await waitFor(() => {
      expect(cogsAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        search: "",
        categoryId: "",
        sortBy: "menu_title",
        sortOrder: "asc",
      });
    });
  });

  it("sends margin desc on second Margin header click", async () => {
    const user = userEvent.setup();

    render(<AdminCogsPage />);
    await screen.findByText("Rendang");

    await user.click(screen.getByRole("button", { name: "Sort by margin %" }));
    await user.click(
      screen.getByRole("button", { name: "Sort by margin % ascending" }),
    );

    await waitFor(() => {
      expect(cogsAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        search: "",
        categoryId: "",
        sortBy: "margin",
        sortOrder: "desc",
      });
    });
  });

  it("resets to page 1 when sort changes", async () => {
    const user = userEvent.setup();
    vi.mocked(cogsAdminApi.list).mockResolvedValue({
      data: [rendangSummary, missingPricesSummary],
      meta: { page: 2, per_page: 10, total: 20 },
    });

    render(<AdminCogsPage />);
    await screen.findByText("Rendang");

    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(cogsAdminApi.list).toHaveBeenLastCalledWith({
        page: 2,
        perPage: 10,
        search: "",
        categoryId: "",
      });
    });

    await user.click(screen.getByRole("button", { name: "Sort by status" }));

    await waitFor(() => {
      expect(cogsAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        search: "",
        categoryId: "",
        sortBy: "status",
        sortOrder: "asc",
      });
    });
  });
});
