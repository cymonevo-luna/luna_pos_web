import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductionRequestDetailContent } from "./production-request-detail-content";
import { productionRequestsAdminApi } from "@/lib/api/production-requests";
import { ApiError } from "@/lib/api/client";
import type { ProductionRequest } from "@/lib/api/types";
import { useRoles } from "@/lib/auth/use-roles";
import { toast } from "sonner";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/auth/use-roles", () => ({
  useRoles: vi.fn(),
}));

vi.mock("@/lib/api/production-requests", () => ({
  productionRequestsAdminApi: {
    get: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    markItemFinished: vi.fn(),
    delete: vi.fn(),
  },
  productionRequestFormToPayload: vi.fn((values) => ({
    items: values.items,
    notes: values.notes?.trim() || undefined,
  })),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const lineStockEstimation = {
  has_formula: true,
  is_fully_producible: true,
  limiting_ingredient_title: "Rice",
  ingredients: [
    {
      food_supply_id: "fs-1",
      food_supply_title: "Rice",
      unit: "gr" as const,
      quantity_per_unit: 200,
      required_quantity: 2000,
      current_stock_quantity: 5000,
      remaining_after: 3000,
      is_sufficient: true,
    },
  ],
};

function createRequest(
  overrides: Partial<ProductionRequest> = {},
): ProductionRequest {
  return {
    id: "prod-1",
    status: "REQUESTED",
    is_fully_producible: true,
    notes: "Rush order",
    created_by_username: "manager1",
    status_history: [
      {
        id: "hist-1",
        from_status: null,
        to_status: "REQUESTED",
        changed_by_username: "manager1",
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    aggregated_ingredients: [
      {
        food_supply_id: "fs-1",
        food_supply_title: "Rice",
        unit: "gr",
        required_quantity: 2000,
        current_stock_quantity: 5000,
        remaining_after: 3000,
        is_sufficient: true,
      },
    ],
    items: [
      {
        id: "item-1",
        menu_id: "menu-1",
        menu_title: "Nasi Goreng",
        quantity: 10,
        is_finished: false,
        stock_estimation: lineStockEstimation,
      },
      {
        id: "item-2",
        menu_id: "menu-2",
        menu_title: "Mie Goreng",
        quantity: 5,
        is_finished: false,
        stock_estimation: lineStockEstimation,
      },
    ],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function mockAdminRoles() {
  vi.mocked(useRoles).mockReturnValue({
    roles: ["admin"],
    hasRole: (role) => role === "admin",
    hasAnyRole: (roles) => roles.includes("admin"),
  });
}

function mockAdminManagerRoles() {
  vi.mocked(useRoles).mockReturnValue({
    roles: ["admin", "manager"],
    hasRole: (role) => role === "admin" || role === "manager",
    hasAnyRole: (roles) =>
      roles.some((role) => role === "admin" || role === "manager"),
  });
}

function mockAdminOperationalRoles() {
  vi.mocked(useRoles).mockReturnValue({
    roles: ["admin", "operational"],
    hasRole: (role) => role === "admin" || role === "operational",
    hasAnyRole: (roles) =>
      roles.some((role) => role === "admin" || role === "operational"),
  });
}

function mockManagerRoles() {
  vi.mocked(useRoles).mockReturnValue({
    roles: ["manager"],
    hasRole: (role) => role === "manager",
    hasAnyRole: (roles) => roles.includes("manager"),
  });
}

function mockOperationalRoles() {
  vi.mocked(useRoles).mockReturnValue({
    roles: ["operational"],
    hasRole: () => false,
    hasAnyRole: (roles) => roles.includes("operational"),
  });
}

describe("ProductionRequestDetailContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockManagerRoles();
    vi.mocked(productionRequestsAdminApi.get).mockResolvedValue({
      data: createRequest(),
    });
  });

  it("renders production request detail with aggregated ingredients and line items", async () => {
    render(<ProductionRequestDetailContent id="prod-1" />);

    expect(await screen.findByText("Production request")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nasi Goreng" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mie Goreng" })).toBeInTheDocument();
    expect(screen.getByText("Aggregated ingredients")).toBeInTheDocument();
    expect(screen.getByText("Status History")).toBeInTheDocument();

    const aggregatedTable = screen
      .getByText("Aggregated ingredients")
      .closest(".rounded-2xl")
      ?.querySelector("table") as HTMLTableElement;
    expect(within(aggregatedTable).getByText("Rice")).toBeInTheDocument();
    expect(within(aggregatedTable).getByText("OK")).toBeInTheDocument();
  });

  it("shows edit form and approve action for REQUESTED status", async () => {
    render(<ProductionRequestDetailContent id="prod-1" />);

    expect(await screen.findByText("Edit request")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Approve to ACCEPTED" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Notes (optional)")).toHaveValue("Rush order");
  });

  it("saves edited quantities for REQUESTED requests", async () => {
    const user = userEvent.setup();
    let current = createRequest();

    vi.mocked(productionRequestsAdminApi.get).mockImplementation(async () => ({
      data: current,
    }));
    vi.mocked(productionRequestsAdminApi.update).mockImplementation(
      async (_id, payload) => {
        current = {
          ...current,
          items: current.items.map((item, index) => ({
            ...item,
            quantity: payload.items[index]?.quantity ?? item.quantity,
          })),
          updated_at: "2026-01-02T00:00:00Z",
        };
        return { data: current };
      },
    );

    render(<ProductionRequestDetailContent id="prod-1" />);
    await screen.findByText("Edit request");

    const quantityInputs = screen.getAllByLabelText("Quantity");
    await user.clear(quantityInputs[0]!);
    await user.type(quantityInputs[0]!, "12");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(productionRequestsAdminApi.update).toHaveBeenCalledWith("prod-1", {
        items: [
          { menu_id: "menu-1", quantity: 12 },
          { menu_id: "menu-2", quantity: 5 },
        ],
        notes: "Rush order",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Production request updated");
  });

  it("approves REQUESTED request to ACCEPTED and hides edit controls", async () => {
    const user = userEvent.setup();
    let current = createRequest();

    vi.mocked(productionRequestsAdminApi.get).mockImplementation(async () => ({
      data: current,
    }));
    vi.mocked(productionRequestsAdminApi.updateStatus).mockImplementation(
      async () => {
        current = {
          ...current,
          status: "ACCEPTED",
          status_history: [
            ...current.status_history,
            {
              id: "hist-2",
              from_status: "REQUESTED",
              to_status: "ACCEPTED",
              changed_by_username: "ops1",
              created_at: "2026-01-02T00:00:00Z",
            },
          ],
        };
        return { data: current };
      },
    );

    render(<ProductionRequestDetailContent id="prod-1" />);
    await screen.findByText("Edit request");

    await user.click(
      screen.getByRole("button", { name: "Approve to ACCEPTED" }),
    );

    await waitFor(() => {
      expect(productionRequestsAdminApi.updateStatus).toHaveBeenCalledWith(
        "prod-1",
        "ACCEPTED",
      );
    });
    await waitFor(() => {
      expect(screen.queryByText("Edit request")).not.toBeInTheDocument();
      expect(screen.getByText("Production progress")).toBeInTheDocument();
    });
    expect(toast.success).toHaveBeenCalledWith("Production request approved");
  });

  it("shows clear error when approve fails with insufficient stock (422)", async () => {
    const user = userEvent.setup();

    vi.mocked(productionRequestsAdminApi.updateStatus).mockRejectedValue(
      new ApiError(
        422,
        "insufficient_stock",
        "Insufficient stock for Rice",
      ),
    );

    render(<ProductionRequestDetailContent id="prod-1" />);
    await screen.findByText("Edit request");

    await user.click(
      screen.getByRole("button", { name: "Approve to ACCEPTED" }),
    );

    expect(
      await screen.findByText("Insufficient stock for Rice"),
    ).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Insufficient stock for Rice");
  });

  it("marks items finished and advances to READY_TO_PICK when all finished", async () => {
    const user = userEvent.setup();
    let current = createRequest({
      status: "ACCEPTED",
      items: [
        {
          id: "item-1",
          menu_id: "menu-1",
          menu_title: "Nasi Goreng",
          quantity: 10,
          is_finished: false,
          stock_estimation: lineStockEstimation,
        },
        {
          id: "item-2",
          menu_id: "menu-2",
          menu_title: "Mie Goreng",
          quantity: 5,
          is_finished: false,
          stock_estimation: lineStockEstimation,
        },
      ],
    });

    vi.mocked(productionRequestsAdminApi.get).mockImplementation(async () => ({
      data: current,
    }));
    vi.mocked(productionRequestsAdminApi.markItemFinished).mockImplementation(
      async (_id, itemId, isFinished) => {
        current = {
          ...current,
          items: current.items.map((item) =>
            item.id === itemId ? { ...item, is_finished: isFinished } : item,
          ),
        };
        return { data: current };
      },
    );
    vi.mocked(productionRequestsAdminApi.updateStatus).mockImplementation(
      async () => {
        current = {
          ...current,
          status: "READY_TO_PICK",
          status_history: [
            ...current.status_history,
            {
              id: "hist-3",
              from_status: "ACCEPTED",
              to_status: "READY_TO_PICK",
              changed_by_username: "ops1",
              created_at: "2026-01-03T00:00:00Z",
            },
          ],
        };
        return { data: current };
      },
    );

    render(<ProductionRequestDetailContent id="prod-1" />);
    await screen.findByText("Production progress");

    const readyButton = screen.getByRole("button", { name: "Ready to pick" });
    expect(readyButton).toBeDisabled();

    await user.click(
      screen.getByRole("checkbox", { name: "Mark Nasi Goreng finished" }),
    );
    await waitFor(() => {
      expect(productionRequestsAdminApi.markItemFinished).toHaveBeenCalledWith(
        "prod-1",
        "item-1",
        true,
      );
    });

    await user.click(
      screen.getByRole("checkbox", { name: "Mark Mie Goreng finished" }),
    );
    await waitFor(() => {
      expect(readyButton).not.toBeDisabled();
    });

    await user.click(readyButton);

    await waitFor(() => {
      expect(productionRequestsAdminApi.updateStatus).toHaveBeenCalledWith(
        "prod-1",
        "READY_TO_PICK",
      );
    });
    await waitFor(() => {
      expect(screen.getByText("Awaiting delivery")).toBeInTheDocument();
    });
  });

  it("keeps Ready to pick disabled while items remain unfinished", async () => {
    vi.mocked(productionRequestsAdminApi.get).mockResolvedValue({
      data: createRequest({
        status: "ACCEPTED",
        items: [
          {
            id: "item-1",
            menu_id: "menu-1",
            menu_title: "Nasi Goreng",
            quantity: 10,
            is_finished: true,
            stock_estimation: lineStockEstimation,
          },
          {
            id: "item-2",
            menu_id: "menu-2",
            menu_title: "Mie Goreng",
            quantity: 5,
            is_finished: false,
            stock_estimation: lineStockEstimation,
          },
        ],
      }),
    });

    render(<ProductionRequestDetailContent id="prod-1" />);
    await screen.findByText("Production progress");

    expect(screen.getByRole("button", { name: "Ready to pick" })).toBeDisabled();
    expect(
      screen.getByText(/1 item still need to be marked finished/),
    ).toBeInTheDocument();
  });

  it("shows read-only completed view for DONE status", async () => {
    vi.mocked(productionRequestsAdminApi.get).mockResolvedValue({
      data: createRequest({
        status: "DONE",
        items: [
          {
            id: "item-1",
            menu_id: "menu-1",
            menu_title: "Nasi Goreng",
            quantity: 10,
            is_finished: true,
            stock_estimation: lineStockEstimation,
          },
        ],
      }),
    });

    render(<ProductionRequestDetailContent id="prod-1" />);
    await screen.findByText("DONE");

    expect(screen.queryByText("Edit request")).not.toBeInTheDocument();
    expect(screen.queryByText("Production progress")).not.toBeInTheDocument();
    expect(screen.getByText("Finished")).toBeInTheDocument();
  });

  it("renders status history timeline", async () => {
    render(<ProductionRequestDetailContent id="prod-1" />);
    await screen.findByText("Status History");

    const historyCard = screen.getByText("Status History").closest(
      ".rounded-2xl",
    ) as HTMLElement;
    expect(within(historyCard).getByText("REQUESTED")).toBeInTheDocument();
    expect(within(historyCard).getByText("manager1")).toBeInTheDocument();
  });

  it("shows delete button for admin-only users", async () => {
    mockAdminRoles();
    render(<ProductionRequestDetailContent id="prod-1" />);

    expect(
      await screen.findByRole("button", { name: "Delete production request" }),
    ).toBeInTheDocument();
  });

  it("hides mutation controls for admin-only REQUESTED requests", async () => {
    mockAdminRoles();
    render(<ProductionRequestDetailContent id="prod-1" />);

    expect(await screen.findByText("Production request")).toBeInTheDocument();
    expect(screen.queryByText("Edit request")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Approve to ACCEPTED" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Notes (optional)")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(screen.getByText("Rush order")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete production request" }),
    ).toBeInTheDocument();
  });

  it("hides operational controls for admin-only ACCEPTED requests", async () => {
    mockAdminRoles();
    vi.mocked(productionRequestsAdminApi.get).mockResolvedValue({
      data: createRequest({
        status: "ACCEPTED",
        items: [
          {
            id: "item-1",
            menu_id: "menu-1",
            menu_title: "Nasi Goreng",
            quantity: 10,
            is_finished: true,
            stock_estimation: lineStockEstimation,
          },
          {
            id: "item-2",
            menu_id: "menu-2",
            menu_title: "Mie Goreng",
            quantity: 5,
            is_finished: false,
            stock_estimation: lineStockEstimation,
          },
        ],
      }),
    });

    render(<ProductionRequestDetailContent id="prod-1" />);

    expect(await screen.findByText("Production request")).toBeInTheDocument();
    expect(screen.queryByText("Production progress")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ready to pick" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Mark Nasi Goreng finished" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Mark Mie Goreng finished" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Finished")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete production request" }),
    ).toBeInTheDocument();
  });

  it("keeps mutation and delete controls for admin+manager users", async () => {
    mockAdminManagerRoles();
    render(<ProductionRequestDetailContent id="prod-1" />);

    expect(await screen.findByText("Edit request")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Approve to ACCEPTED" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete production request" }),
    ).toBeInTheDocument();
  });

  it("keeps mutation and delete controls for admin+operational users on REQUESTED", async () => {
    mockAdminOperationalRoles();
    render(<ProductionRequestDetailContent id="prod-1" />);

    expect(await screen.findByText("Edit request")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Approve to ACCEPTED" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete production request" }),
    ).toBeInTheDocument();
  });

  it("does not show delete for manager but keeps manager actions", async () => {
    mockManagerRoles();
    render(<ProductionRequestDetailContent id="prod-1" />);

    await screen.findByText("Edit request");
    expect(
      screen.queryByRole("button", { name: "Delete production request" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Approve to ACCEPTED" }),
    ).toBeInTheDocument();
  });

  it("does not show delete for operational users", async () => {
    mockOperationalRoles();
    render(<ProductionRequestDetailContent id="prod-1" />);

    await screen.findByText("Production request");
    expect(
      screen.queryByRole("button", { name: "Delete production request" }),
    ).not.toBeInTheDocument();
  });

  it("deletes production request and redirects to list on confirm", async () => {
    const user = userEvent.setup();
    mockAdminRoles();
    vi.mocked(productionRequestsAdminApi.delete).mockResolvedValue({
      data: undefined,
    });

    render(<ProductionRequestDetailContent id="prod-1" />);
    await screen.findByText("Production request");

    await user.click(
      screen.getByRole("button", { name: "Delete production request" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(productionRequestsAdminApi.delete).toHaveBeenCalledWith("prod-1");
    });
    expect(toast.success).toHaveBeenCalledWith("Production request deleted");
    expect(mockPush).toHaveBeenCalledWith("/admin/production-requests");
  });

  it("notes stock reversal in delete dialog for ACCEPTED requests", async () => {
    const user = userEvent.setup();
    mockAdminRoles();
    vi.mocked(productionRequestsAdminApi.get).mockResolvedValue({
      data: createRequest({ status: "ACCEPTED" }),
    });

    render(<ProductionRequestDetailContent id="prod-1" />);
    await screen.findByText("Production request");

    await user.click(
      screen.getByRole("button", { name: "Delete production request" }),
    );

    expect(
      screen.getByText(/Deducted ingredient stock will be reversed/),
    ).toBeInTheDocument();
  });
});
