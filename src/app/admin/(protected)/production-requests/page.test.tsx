import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminProductionRequestsPage from "./page";
import { productionRequestsAdminApi } from "@/lib/api/production-requests";
import { ApiError } from "@/lib/api/client";
import type { ProductionRequestSummary } from "@/lib/api/types";
import { toast } from "sonner";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/api/production-requests", () => ({
  productionRequestsAdminApi: {
    list: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const request: ProductionRequestSummary = {
  id: "prod-1",
  status: "REQUESTED",
  is_fully_producible: true,
  item_count: 2,
  created_by_username: "manager1",
  created_at: "2026-01-15T10:30:00Z",
  updated_at: "2026-01-15T10:30:00Z",
};

describe("AdminProductionRequestsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(productionRequestsAdminApi.list).mockResolvedValue({
      data: [request],
      meta: { page: 1, per_page: 10, total: 1 },
    });
  });

  it("renders table headers and production request rows from the API", async () => {
    render(<AdminProductionRequestsPage />);

    expect(await screen.findByText("REQUESTED")).toBeInTheDocument();
    expect(screen.getByText("manager1")).toBeInTheDocument();
    expect(screen.getByText("1 total")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Created" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Status" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Items" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Stock OK" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Created by" }),
    ).toBeInTheDocument();
  });

  it("shows empty state when no production requests match", async () => {
    vi.mocked(productionRequestsAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 10, total: 0 },
    });

    render(<AdminProductionRequestsPage />);

    expect(
      await screen.findByText("No production requests found."),
    ).toBeInTheDocument();
  });

  it("reloads with status filter", async () => {
    const user = userEvent.setup();

    render(<AdminProductionRequestsPage />);
    await screen.findByText("REQUESTED");

    await user.selectOptions(
      screen.getByLabelText("Filter by status"),
      "ACCEPTED",
    );

    await waitFor(() => {
      expect(productionRequestsAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        status: "ACCEPTED",
      });
    });
  });

  it("navigates to detail on row click", async () => {
    const user = userEvent.setup();

    render(<AdminProductionRequestsPage />);
    await screen.findByText("manager1");

    await user.click(screen.getByText("manager1"));

    expect(mockPush).toHaveBeenCalledWith("/admin/production-requests/prod-1");
  });

  it("shows em dash when created_by_username is null", async () => {
    vi.mocked(productionRequestsAdminApi.list).mockResolvedValue({
      data: [{ ...request, created_by_username: null }],
      meta: { page: 1, per_page: 10, total: 1 },
    });

    render(<AdminProductionRequestsPage />);

    expect(await screen.findByText("REQUESTED")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows error toast when loading fails", async () => {
    vi.mocked(productionRequestsAdminApi.list).mockRejectedValue(
      new ApiError(500, "server_error", "Server error"),
    );

    render(<AdminProductionRequestsPage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Server error");
    });
  });

  it("shows No when is_fully_producible is false", async () => {
    vi.mocked(productionRequestsAdminApi.list).mockResolvedValue({
      data: [{ ...request, is_fully_producible: false }],
      meta: { page: 1, per_page: 10, total: 1 },
    });

    render(<AdminProductionRequestsPage />);

    expect(await screen.findByText("No")).toBeInTheDocument();
  });
});
