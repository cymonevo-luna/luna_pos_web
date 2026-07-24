import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminOrderOptionsPage from "./page";
import { orderOptionsAdminApi } from "@/lib/api/order-options";
import { ApiError } from "@/lib/api/client";
import type { OrderOption } from "@/lib/api/types";
import { toast } from "sonner";

vi.mock("@/lib/api/order-options", () => ({
  orderOptionsAdminApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    reorder: vi.fn(),
  },
  orderOptionFormToPayload: vi.fn((values) => ({
    name: values.name.trim(),
    additional_price: values.additional_price ?? 0,
  })),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const dineIn: OrderOption = {
  id: "opt-1",
  name: "Dine-In",
  additional_price: 0,
  priority: 10,
  ingredient_count: 2,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

const takeAway: OrderOption = {
  id: "opt-2",
  name: "Take Away",
  additional_price: 0,
  priority: 5,
  ingredient_count: 0,
  created_at: "2026-01-02T00:00:00Z",
  updated_at: "2026-01-16T00:00:00Z",
};

const box: OrderOption = {
  id: "opt-3",
  name: "Box",
  additional_price: 3000,
  priority: 3,
  ingredient_count: 1,
  created_at: "2026-01-03T00:00:00Z",
  updated_at: "2026-01-17T00:00:00Z",
};

describe("AdminOrderOptionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orderOptionsAdminApi.list).mockResolvedValue({
      data: [dineIn],
      meta: { page: 1, per_page: 100, total: 1 },
    });
    vi.mocked(orderOptionsAdminApi.reorder).mockResolvedValue({
      data: [dineIn],
    });
  });

  it("renders order options from the API", async () => {
    render(<AdminOrderOptionsPage />);

    expect(await screen.findByText("Dine-In")).toBeInTheDocument();
    expect(screen.getByText("1 total")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add Order Option" }),
    ).toBeInTheDocument();
  });

  it("shows empty state when no order options match", async () => {
    vi.mocked(orderOptionsAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 100, total: 0 },
    });

    render(<AdminOrderOptionsPage />);

    expect(
      await screen.findByText("No order options configured."),
    ).toBeInTheDocument();
  });

  it("debounces search and reloads with the search term", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<AdminOrderOptionsPage />);
    await screen.findByText("Dine-In");

    await user.type(screen.getByPlaceholderText("Search by name"), "Dine");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(orderOptionsAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        search: "Dine",
      });
    });

    vi.useRealTimers();
  });

  it("deletes an order option after confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(orderOptionsAdminApi.delete).mockResolvedValue({
      data: undefined,
    });

    render(<AdminOrderOptionsPage />);
    await screen.findByText("Dine-In");

    await user.click(screen.getByLabelText("Delete order option"));
    expect(screen.getByText("Delete order option")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(orderOptionsAdminApi.delete).toHaveBeenCalledWith("opt-1");
    });
    expect(toast.success).toHaveBeenCalledWith("Order option deleted");
  });

  it("shows error when deleting an order option in use", async () => {
    const user = userEvent.setup();
    vi.mocked(orderOptionsAdminApi.delete).mockRejectedValue(
      new ApiError(
        409,
        "conflict",
        "Cannot delete order option referenced by transactions",
      ),
    );

    render(<AdminOrderOptionsPage />);
    await screen.findByText("Dine-In");

    await user.click(screen.getByLabelText("Delete order option"));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Cannot delete order option referenced by transactions",
      );
    });
    expect(screen.getByRole("cell", { name: "Dine-In" })).toBeInTheDocument();
  });

  it("creates an order option with surcharge from the dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(orderOptionsAdminApi.create).mockResolvedValue({
      data: {
        ...box,
      },
    });

    render(<AdminOrderOptionsPage />);
    await screen.findByText("Dine-In");

    await user.click(screen.getByRole("button", { name: "Add Order Option" }));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText("Name"), "Box");
    await user.clear(within(dialog).getByLabelText("Additional Price (IDR)"));
    await user.type(
      within(dialog).getByLabelText("Additional Price (IDR)"),
      "3000",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Add Order Option" }),
    );

    await waitFor(() => {
      expect(orderOptionsAdminApi.create).toHaveBeenCalledWith({
        name: "Box",
        additional_price: 3000,
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Order option created");
  });

  it("edits an order option surcharge from the dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(orderOptionsAdminApi.update).mockResolvedValue({
      data: {
        ...dineIn,
        additional_price: 5000,
      },
    });

    render(<AdminOrderOptionsPage />);
    await screen.findByText("Dine-In");

    await user.click(screen.getByLabelText("Edit order option"));

    const priceInput = screen.getByLabelText("Additional Price (IDR)");
    await user.clear(priceInput);
    await user.type(priceInput, "5000");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(orderOptionsAdminApi.update).toHaveBeenCalledWith("opt-1", {
        name: "Dine-In",
        additional_price: 5000,
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Order option updated");
  });

  it("rejects negative additional price in the dialog", async () => {
    const user = userEvent.setup();

    render(<AdminOrderOptionsPage />);
    await screen.findByText("Dine-In");

    await user.click(screen.getByRole("button", { name: "Add Order Option" }));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText("Name"), "Box");
    await user.clear(within(dialog).getByLabelText("Additional Price (IDR)"));
    await user.type(
      within(dialog).getByLabelText("Additional Price (IDR)"),
      "-100",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Add Order Option" }),
    );

    expect(
      await screen.findByText("Additional price cannot be negative"),
    ).toBeInTheDocument();
    expect(orderOptionsAdminApi.create).not.toHaveBeenCalled();
  });

  it("shows formatted additional price in the list", async () => {
    vi.mocked(orderOptionsAdminApi.list).mockResolvedValue({
      data: [dineIn, box],
      meta: { page: 1, per_page: 100, total: 2 },
    });

    render(<AdminOrderOptionsPage />);

    await screen.findByText("Box");
    expect(screen.getByText("Rp 0")).toBeInTheDocument();
    expect(screen.getByText("Rp 3.000")).toBeInTheDocument();
  });

  it("creates an order option from the dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(orderOptionsAdminApi.create).mockResolvedValue({
      data: {
        ...dineIn,
        id: "opt-2",
        name: "Take Away",
      },
    });

    render(<AdminOrderOptionsPage />);
    await screen.findByText("Dine-In");

    await user.click(screen.getByRole("button", { name: "Add Order Option" }));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText("Name"), "Take Away");
    await user.click(
      within(dialog).getByRole("button", { name: "Add Order Option" }),
    );

    await waitFor(() => {
      expect(orderOptionsAdminApi.create).toHaveBeenCalledWith({
        name: "Take Away",
        additional_price: 0,
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Order option created");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("edits an order option from the dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(orderOptionsAdminApi.update).mockResolvedValue({
      data: {
        ...dineIn,
        name: "Dine In",
      },
    });

    render(<AdminOrderOptionsPage />);
    await screen.findByText("Dine-In");

    await user.click(screen.getByLabelText("Edit order option"));
    expect(screen.getByText("Edit order option")).toBeInTheDocument();

    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Dine In");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(orderOptionsAdminApi.update).toHaveBeenCalledWith("opt-1", {
        name: "Dine In",
        additional_price: 0,
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Order option updated");
  });

  it("maps duplicate name conflict onto the name field", async () => {
    const user = userEvent.setup();
    vi.mocked(orderOptionsAdminApi.create).mockRejectedValue(
      new ApiError(409, "conflict", "Order option name already exists"),
    );

    render(<AdminOrderOptionsPage />);
    await screen.findByText("Dine-In");

    await user.click(screen.getByRole("button", { name: "Add Order Option" }));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText("Name"), "Dine-In");
    await user.click(
      within(dialog).getByRole("button", { name: "Add Order Option" }),
    );

    expect(
      await screen.findByText("Order option name already exists"),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders drag handles when not searching", async () => {
    vi.mocked(orderOptionsAdminApi.list).mockResolvedValue({
      data: [dineIn, takeAway, box],
      meta: { page: 1, per_page: 100, total: 3 },
    });

    render(<AdminOrderOptionsPage />);

    await screen.findByText("Dine-In");
    expect(screen.getAllByLabelText("Drag to reorder")).toHaveLength(3);
  });

  it("calls reorder with the new order when drag ends", async () => {
    vi.mocked(orderOptionsAdminApi.list).mockResolvedValue({
      data: [takeAway, box, dineIn],
      meta: { page: 1, per_page: 100, total: 3 },
    });

    const { handleOrderOptionDragEnd } = await import("./order-option-reorder");

    render(<AdminOrderOptionsPage />);
    await screen.findByText("Take Away");

    await handleOrderOptionDragEnd(
      {
        active: { id: "opt-3" },
        over: { id: "opt-2" },
      } as never,
      {
        orderOptions: [takeAway, box, dineIn],
        setOrderOptions: vi.fn(),
        reorder: orderOptionsAdminApi.reorder,
        onSuccess: () => toast.success("Order option priority saved"),
        onError: (message) => toast.error(message),
        reload: vi.fn(),
      },
    );

    expect(orderOptionsAdminApi.reorder).toHaveBeenCalledWith([
      "opt-3",
      "opt-2",
      "opt-1",
    ]);
    expect(toast.success).toHaveBeenCalledWith("Order option priority saved");
  });

  it("reverts order and shows an error toast when reorder fails", async () => {
    const orderOptions = [takeAway, box, dineIn];
    const { handleOrderOptionDragEnd } = await import("./order-option-reorder");

    vi.mocked(orderOptionsAdminApi.reorder).mockRejectedValue(
      new ApiError(500, "error", "Failed to save order"),
    );

    const setOrderOptions = vi.fn();

    await handleOrderOptionDragEnd(
      {
        active: { id: "opt-3" },
        over: { id: "opt-2" },
      } as never,
      {
        orderOptions,
        setOrderOptions,
        reorder: orderOptionsAdminApi.reorder,
        onSuccess: () => toast.success("Order option priority saved"),
        onError: (message) => toast.error(message),
        reload: vi.fn(),
      },
    );

    expect(orderOptionsAdminApi.reorder).toHaveBeenCalledWith([
      "opt-3",
      "opt-2",
      "opt-1",
    ]);
    expect(setOrderOptions).toHaveBeenLastCalledWith(orderOptions);
    expect(toast.error).toHaveBeenCalledWith("Failed to save order");
  });

  it("disables reorder affordance while search is active", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    vi.mocked(orderOptionsAdminApi.list).mockResolvedValue({
      data: [dineIn, takeAway, box],
      meta: { page: 1, per_page: 10, total: 3 },
    });

    render(<AdminOrderOptionsPage />);
    await screen.findByText("Dine-In");
    expect(screen.getAllByLabelText("Drag to reorder")).toHaveLength(3);

    await user.type(screen.getByPlaceholderText("Search by name"), "Din");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(
        screen.getByText("Clear search to reorder order options."),
      ).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("Drag to reorder")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("shows priority and ingredient count columns", async () => {
    render(<AdminOrderOptionsPage />);

    await screen.findByText("Dine-In");
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByLabelText("Manage ingredients")).toBeInTheDocument();
  });
});
