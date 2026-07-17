import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminFoodSuppliesPage from "./page";
import { foodSuppliesAdminApi } from "@/lib/api/food-supplies";
import { ApiError } from "@/lib/api/client";
import type { FoodSupply } from "@/lib/api/types";
import { toast } from "sonner";

vi.mock("@/lib/api/food-supplies", () => ({
  foodSuppliesAdminApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  foodSupplyFormToPayload: vi.fn((values) => ({
    title: values.title,
    stock_quantity: values.stock_quantity,
    unit: values.unit,
    ...(values.description?.trim()
      ? { description: values.description.trim() }
      : {}),
    ...(values.cooking_measurements?.length
      ? {
          cooking_measurements: values.cooking_measurements.map(
            (measurement: {
              id?: string;
              name: string;
              conversion_quantity: string;
            }) => ({
              ...(measurement.id ? { id: measurement.id } : {}),
              name: measurement.name.trim(),
              conversion_quantity: measurement.conversion_quantity.trim(),
            }),
          ),
        }
      : {}),
  })),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const supply: FoodSupply = {
  id: "fs-1",
  title: "Olive oil",
  description: "Extra virgin",
  stock_quantity: 500,
  unit: "ml",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
  manual_edit_history: [],
  cooking_measurements: [],
};

describe("AdminFoodSuppliesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(foodSuppliesAdminApi.list).mockResolvedValue({
      data: [supply],
      meta: { page: 1, per_page: 10, total: 1 },
    });
    vi.mocked(foodSuppliesAdminApi.get).mockResolvedValue({
      data: supply,
    });
  });

  it("renders supplies from the API", async () => {
    render(<AdminFoodSuppliesPage />);

    expect(await screen.findByText("Olive oil")).toBeInTheDocument();
    expect(screen.getByText("Extra virgin")).toBeInTheDocument();
    expect(screen.getByText("500 ml")).toBeInTheDocument();
    expect(screen.getByText("1 total")).toBeInTheDocument();
  });

  it("shows converted stock for large gram quantities", async () => {
    vi.mocked(foodSuppliesAdminApi.list).mockResolvedValue({
      data: [
        {
          ...supply,
          title: "Rice",
          stock_quantity: 2000,
          unit: "gr",
        },
      ],
      meta: { page: 1, per_page: 10, total: 1 },
    });

    render(<AdminFoodSuppliesPage />);

    expect(await screen.findByText("Rice")).toBeInTheDocument();
    expect(screen.getByText("2 kg")).toBeInTheDocument();
    expect(screen.queryByText("2000 gr")).not.toBeInTheDocument();
  });

  it("renders stock quantity when API returns it as a string", async () => {
    vi.mocked(foodSuppliesAdminApi.list).mockResolvedValue({
      data: [
        {
          ...supply,
          stock_quantity: "500" as unknown as FoodSupply["stock_quantity"],
        },
      ],
      meta: { page: 1, per_page: 10, total: 1 },
    });

    render(<AdminFoodSuppliesPage />);

    expect(await screen.findByText("Olive oil")).toBeInTheDocument();
    expect(screen.getByText("500 ml")).toBeInTheDocument();
  });

  it("shows empty state when no supplies match", async () => {
    vi.mocked(foodSuppliesAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 10, total: 0 },
    });

    render(<AdminFoodSuppliesPage />);

    expect(
      await screen.findByText("No food supplies found."),
    ).toBeInTheDocument();
  });

  it("debounces search and reloads with the search term", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<AdminFoodSuppliesPage />);
    await screen.findByText("Olive oil");

    await user.type(screen.getByPlaceholderText("Search by title"), "oil");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(foodSuppliesAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        search: "oil",
      });
    });

    vi.useRealTimers();
  });

  it("deletes a supply after confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(foodSuppliesAdminApi.delete).mockResolvedValue({
      data: undefined,
    });

    render(<AdminFoodSuppliesPage />);
    await screen.findByText("Olive oil");

    await user.click(screen.getByLabelText("Delete food supply"));
    expect(screen.getByText("Delete food supply")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(foodSuppliesAdminApi.delete).toHaveBeenCalledWith("fs-1");
    });
  });

  it("shows short unit labels in the create dialog", async () => {
    const user = userEvent.setup();

    render(<AdminFoodSuppliesPage />);
    await screen.findByText("Olive oil");

    await user.click(screen.getAllByRole("button", { name: "Add supply" })[0]);
    const dialog = screen.getByRole("dialog");
    const unitSelect = within(dialog).getByLabelText("Unit");

    expect(within(unitSelect).getByRole("option", { name: "ml" })).toBeInTheDocument();
    expect(within(unitSelect).getByRole("option", { name: "gr" })).toBeInTheDocument();
    expect(within(unitSelect).getByRole("option", { name: "pcs" })).toBeInTheDocument();
  });

  it("creates a supply from the dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(foodSuppliesAdminApi.create).mockResolvedValue({
      data: {
        ...supply,
        id: "fs-2",
        title: "Tomato Sauce",
        description: "House recipe",
        stock_quantity: 750,
        unit: "ml",
      },
    });

    render(<AdminFoodSuppliesPage />);
    await screen.findByText("Olive oil");

    await user.click(screen.getAllByRole("button", { name: "Add supply" })[0]);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Title"), "Tomato Sauce");
    await user.type(within(dialog).getByLabelText(/Description/), "House recipe");
    await user.clear(within(dialog).getByLabelText("Stock quantity"));
    await user.type(within(dialog).getByLabelText("Stock quantity"), "750");
    await user.selectOptions(within(dialog).getByLabelText("Unit"), "ml");
    await user.click(
      within(dialog).getByRole("button", { name: "Add supply" }),
    );

    await waitFor(() => {
      expect(foodSuppliesAdminApi.create).toHaveBeenCalledWith({
        title: "Tomato Sauce",
        description: "House recipe",
        stock_quantity: 750,
        unit: "ml",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Food supply created");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("edits a supply from the dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(foodSuppliesAdminApi.update).mockResolvedValue({
      data: {
        ...supply,
        stock_quantity: 1.5,
        unit: "gr",
      },
    });
    vi.mocked(foodSuppliesAdminApi.get)
      .mockResolvedValueOnce({ data: supply })
      .mockResolvedValueOnce({
        data: {
          ...supply,
          stock_quantity: 1.5,
          unit: "gr",
        },
      });

    render(<AdminFoodSuppliesPage />);
    await screen.findByText("Olive oil");

    await user.click(screen.getByLabelText("Edit food supply"));
    expect(screen.getByText("Edit food supply")).toBeInTheDocument();
    expect(screen.getByLabelText("Unit")).toHaveValue("ml");

    await user.clear(screen.getByLabelText("Stock quantity"));
    await user.type(screen.getByLabelText("Stock quantity"), "1.5");
    await user.selectOptions(screen.getByLabelText("Unit"), "gr");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(foodSuppliesAdminApi.update).toHaveBeenCalledWith("fs-1", {
        title: "Olive oil",
        description: "Extra virgin",
        stock_quantity: 1.5,
        unit: "gr",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Food supply updated");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("maps server validation errors onto form fields", async () => {
    const user = userEvent.setup();
    vi.mocked(foodSuppliesAdminApi.create).mockRejectedValue(
      new ApiError(422, "validation_error", "Validation failed", {
        unit: "Invalid unit value",
      }),
    );

    render(<AdminFoodSuppliesPage />);
    await screen.findByText("Olive oil");

    await user.click(screen.getAllByRole("button", { name: "Add supply" })[0]);
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText("Title"), "Tomato Sauce");
    await user.clear(within(dialog).getByLabelText("Stock quantity"));
    await user.type(within(dialog).getByLabelText("Stock quantity"), "10");
    await user.selectOptions(within(dialog).getByLabelText("Unit"), "ml");
    await user.click(
      within(dialog).getByRole("button", { name: "Add supply" }),
    );

    expect(await screen.findByText("Invalid unit value")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the dialog on cancel without saving", async () => {
    const user = userEvent.setup();

    render(<AdminFoodSuppliesPage />);
    await screen.findByText("Olive oil");

    await user.click(screen.getAllByRole("button", { name: "Add supply" })[0]);
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Title"), "Eggs");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(foodSuppliesAdminApi.create).not.toHaveBeenCalled();
  });

  it("loads detail and shows empty manual edit history in edit dialog", async () => {
    const user = userEvent.setup();

    render(<AdminFoodSuppliesPage />);
    await screen.findByText("Olive oil");

    await user.click(screen.getByLabelText("Edit food supply"));

    const dialog = await screen.findByRole("dialog");
    await waitFor(() => {
      expect(foodSuppliesAdminApi.get).toHaveBeenCalledWith("fs-1");
    });
    expect(
      within(dialog).getByText("No manual quantity edits yet"),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("columnheader", { name: "Delta (ml)" }),
    ).not.toBeInTheDocument();
  });

  it("shows manual edit history after quantity save and refetches detail", async () => {
    const user = userEvent.setup();
    const historyEntry = {
      delta_quantity: "100",
      previous_quantity: "500",
      new_quantity: "600",
      changed_by_username: "ops-user",
      created_at: "2026-03-01T10:00:00Z",
    };

    vi.mocked(foodSuppliesAdminApi.get)
      .mockResolvedValueOnce({ data: supply })
      .mockResolvedValueOnce({
        data: {
          ...supply,
          stock_quantity: 600,
          manual_edit_history: [historyEntry],
        },
      });

    vi.mocked(foodSuppliesAdminApi.update).mockResolvedValue({
      data: { ...supply, stock_quantity: 600 },
    });

    render(<AdminFoodSuppliesPage />);
    await screen.findByText("Olive oil");

    await user.click(screen.getByLabelText("Edit food supply"));
    await screen.findByText("No manual quantity edits yet");

    await user.clear(screen.getByLabelText("Stock quantity"));
    await user.type(screen.getByLabelText("Stock quantity"), "600");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(foodSuppliesAdminApi.update).toHaveBeenCalled();
      expect(foodSuppliesAdminApi.get).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText("+100")).toBeInTheDocument();
    expect(screen.getByText("ops-user")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("keeps manual edit history unchanged after title-only save", async () => {
    const user = userEvent.setup();
    const historyEntry = {
      delta_quantity: "10",
      previous_quantity: "490",
      new_quantity: "500",
      changed_by_username: "ops-user",
      created_at: "2026-03-01T09:00:00Z",
    };
    const supplyWithHistory = {
      ...supply,
      manual_edit_history: [historyEntry],
    };

    vi.mocked(foodSuppliesAdminApi.get).mockResolvedValue({
      data: supplyWithHistory,
    });
    vi.mocked(foodSuppliesAdminApi.update).mockResolvedValue({
      data: { ...supplyWithHistory, title: "Premium olive oil" },
    });

    render(<AdminFoodSuppliesPage />);
    await screen.findByText("Olive oil");

    await user.click(screen.getByLabelText("Edit food supply"));
    expect(await screen.findByText("+10")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Premium olive oil");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(foodSuppliesAdminApi.update).toHaveBeenCalled();
      expect(foodSuppliesAdminApi.get).toHaveBeenCalledTimes(2);
    });

    expect(screen.getAllByText("+10")).toHaveLength(1);
  });
});
