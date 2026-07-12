import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminNewProductionRequestPage from "./page";
import { productionRequestsAdminApi } from "@/lib/api/production-requests";
import { toast } from "sonner";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/api/production-requests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/production-requests")>();
  return {
    ...actual,
    productionRequestsAdminApi: {
      ...actual.productionRequestsAdminApi,
      create: vi.fn(),
    },
  };
});

vi.mock("@/components/admin/production-request-form", () => ({
  ProductionRequestForm: ({
    submitLabel,
    onSubmit,
  }: {
    submitLabel?: string;
    onSubmit: (values: {
      items: Array<{ menu_id: string; quantity: number }>;
      notes?: string;
    }) => void | Promise<void>;
  }) => (
    <form
      aria-label="Production request form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          items: [{ menu_id: "menu-a", quantity: 5 }],
          notes: "Morning batch",
        });
      }}
    >
      <button type="submit">{submitLabel ?? "Create production request"}</button>
    </form>
  ),
}));

describe("AdminNewProductionRequestPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(productionRequestsAdminApi.create).mockResolvedValue({
      data: {
        id: "pr-1",
        status: "REQUESTED",
        is_fully_producible: true,
        items: [],
        aggregated_ingredients: [],
        status_history: [],
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    });
  });

  it("renders the form and back link", () => {
    render(<AdminNewProductionRequestPage />);

    expect(
      screen.getByRole("link", { name: /Back to production requests/i }),
    ).toHaveAttribute("href", "/admin/production-requests");
    expect(
      screen.getByRole("heading", { name: "New production request" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: "Production request form" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create production request" }),
    ).toBeInTheDocument();
  });

  it("creates production request and redirects on success", async () => {
    const user = userEvent.setup();
    render(<AdminNewProductionRequestPage />);

    await user.click(
      screen.getByRole("button", { name: "Create production request" }),
    );

    expect(productionRequestsAdminApi.create).toHaveBeenCalledWith({
      items: [{ menu_id: "menu-a", quantity: 5 }],
      notes: "Morning batch",
    });
    expect(toast.success).toHaveBeenCalledWith("Production request created");
    expect(push).toHaveBeenCalledWith("/admin/production-requests/pr-1");
  });
});
