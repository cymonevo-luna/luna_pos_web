import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { filterAdminNavItems } from "@/app/admin/(protected)/layout";
import { canAccessRoute } from "@/lib/auth/roles";
import AdminSuppliersPage from "@/app/admin/(protected)/suppliers/page";
import AdminFoodSuppliesPage from "@/app/admin/(protected)/food-supplies/page";
import AdminPurchasesPage from "@/app/admin/(protected)/purchases/page";
import { suppliersAdminApi } from "@/lib/api/suppliers";
import { foodSuppliesAdminApi } from "@/lib/api/food-supplies";
import { purchaseRequestsAdminApi } from "@/lib/api/purchase-requests";
import type { Supplier } from "@/lib/api/types";
import type { NavItem } from "@/components/layout/dashboard-shell";
import { sourceWithFeatures } from "@/lib/auth/feature-fixtures";

vi.mock("@/lib/api/suppliers", () => ({
  suppliersAdminApi: {
    list: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/api/food-supplies", () => ({
  foodSuppliesAdminApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  foodSupplyFormToPayload: vi.fn((values) => values),
}));

vi.mock("@/lib/api/purchase-requests", () => ({
  purchaseRequestsAdminApi: {
    list: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const navItems: NavItem[] = [
  { href: "/admin", label: "Overview", icon: () => null },
  {
    href: "/admin/food-supplies",
    label: "Food Supplies",
    icon: () => null,
    roles: ["manager", "operational"],
    feature: "food_supplies.manage",
  },
  {
    href: "/admin/suppliers",
    label: "Suppliers",
    icon: () => null,
    roles: ["operational"],
    feature: "suppliers.manage",
  },
  {
    href: "/admin/purchases",
    label: "Purchases",
    icon: () => null,
    roles: ["operational"],
    feature: "purchases.manage",
  },
];

function listItem(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: "sup-1",
    name: "Beras Supplier",
    phone_number: "08123456789",
    address: "Jl. Pasar 12",
    supports_delivery: true,
    delivery_cost: 15000,
    price_quotes: [],
    price_quotes_count: 3,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
    ...overrides,
  };
}

/**
 * Checklist coverage for POS-29-2 — supplier admin list page contract.
 */
describe("POS-29-2 supplier admin list verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(suppliersAdminApi.list).mockResolvedValue({
      data: [listItem()],
      meta: { page: 1, per_page: 10, total: 1 },
    });
    vi.mocked(foodSuppliesAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 10, total: 0 },
    });
    vi.mocked(purchaseRequestsAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 10, total: 0 },
    });
  });

  it("1. Supplier page loads without error", async () => {
    render(<AdminSuppliersPage />);

    expect(await screen.findByText("Beras Supplier")).toBeInTheDocument();
    expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument();
    expect(screen.getByText("Suppliers")).toBeInTheDocument();
  });

  it("2. Supplier page list request uses page=1 and per_page=10", async () => {
    render(<AdminSuppliersPage />);
    await screen.findByText("Beras Supplier");

    expect(suppliersAdminApi.list).toHaveBeenCalledWith({
      page: 1,
      perPage: 10,
      search: "",
    });
  });

  it("3. Supplier empty state displays", async () => {
    vi.mocked(suppliersAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 10, total: 0 },
    });

    render(<AdminSuppliersPage />);

    expect(await screen.findByText("No suppliers found.")).toBeInTheDocument();
    expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument();
  });

  it("4. Supplier list renders created supplier with price quote count", async () => {
    render(<AdminSuppliersPage />);

    expect(await screen.findByText("Beras Supplier")).toBeInTheDocument();
    expect(screen.getByText("08123456789")).toBeInTheDocument();
    expect(screen.getByText("Jl. Pasar 12")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("5. Supplier pagination controls fetch page 2", async () => {
    const user = userEvent.setup();
    vi.mocked(suppliersAdminApi.list)
      .mockResolvedValueOnce({
        data: Array.from({ length: 10 }, (_, index) =>
          listItem({
            id: `sup-${index + 1}`,
            name: `Supplier ${index + 1}`,
          }),
        ),
        meta: { page: 1, per_page: 10, total: 15 },
      })
      .mockResolvedValueOnce({
        data: [listItem({ id: "sup-11", name: "Supplier 11" })],
        meta: { page: 2, per_page: 10, total: 15 },
      });

    render(<AdminSuppliersPage />);
    await screen.findByText("Supplier 1");
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(suppliersAdminApi.list).toHaveBeenLastCalledWith({
        page: 2,
        perPage: 10,
        search: "",
      });
    });
    expect(await screen.findByText("Supplier 11")).toBeInTheDocument();
  });

  it("6. Other admin pages regression — food supplies and purchases load", async () => {
    render(<AdminFoodSuppliesPage />);
    expect(
      await screen.findByText("No food supplies found."),
    ).toBeInTheDocument();

    render(<AdminPurchasesPage />);
    expect(
      await screen.findByText("No purchase requests found."),
    ).toBeInTheDocument();
  });

  it("operational role sees Suppliers nav link", () => {
    const operational = sourceWithFeatures(["operational"]);
    expect(canAccessRoute("/admin/suppliers", operational)).toBe(true);
    const labels = filterAdminNavItems(navItems, operational).map(
      (item) => item.label,
    );
    expect(labels).toContain("Suppliers");
  });
});
