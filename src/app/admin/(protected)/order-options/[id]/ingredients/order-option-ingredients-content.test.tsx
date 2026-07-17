import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminOrderOptionIngredientsContent } from "./order-option-ingredients-content";
import { orderOptionsAdminApi } from "@/lib/api/order-options";
import { getOrderOptionIngredients } from "@/lib/api/order-option-ingredients";
import { ApiError } from "@/lib/api/client";
import type { OrderOption } from "@/lib/api/types";

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

vi.mock("@/lib/api/order-options", () => ({
  orderOptionsAdminApi: {
    get: vi.fn(),
  },
}));

vi.mock("@/lib/api/order-option-ingredients", () => ({
  getOrderOptionIngredients: vi.fn(),
  replaceOrderOptionIngredients: vi.fn(),
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

const takeAway: OrderOption = {
  id: "opt-takeaway",
  name: "Take Away",
  priority: 10,
  ingredient_count: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

function renderPage(id = "opt-takeaway") {
  return render(<AdminOrderOptionIngredientsContent id={id} />);
}

describe("AdminOrderOptionIngredientsContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orderOptionsAdminApi.get).mockResolvedValue({ data: takeAway });
    vi.mocked(getOrderOptionIngredients).mockResolvedValue({
      data: {
        order_option_id: "opt-takeaway",
        ingredients: [],
      },
    });
  });

  it("renders option name in header after load", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", {
        name: "Ingredients — Take Away",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to order options" }),
    ).toHaveAttribute("href", "/admin/order-options");
    expect(
      screen.getByRole("region", { name: "Order option ingredients" }),
    ).toBeInTheDocument();
  });

  it("shows error state for invalid order option id", async () => {
    vi.mocked(orderOptionsAdminApi.get).mockRejectedValue(
      new ApiError(404, "not_found", "Order option not found"),
    );

    renderPage("bad-id");

    expect(await screen.findByText("Order option not found.")).toBeInTheDocument();
    const backLinks = screen.getAllByRole("link", {
      name: "Back to order options",
    });
    expect(backLinks.length).toBeGreaterThan(0);
    expect(backLinks[0]).toHaveAttribute("href", "/admin/order-options");
  });
});
