import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminProductionRequestsPage from "./page";
import { productionRequestsAdminApi } from "@/lib/api/production-requests";
import { ApiError } from "@/lib/api/client";
import type { ProductionRequestSummary, User } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { toast } from "sonner";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/auth/context", () => ({
  useAuth: vi.fn(),
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

const managerUser: User = {
  id: "manager-1",
  email: "manager-test@cymonevo.com",
  name: "Manager Test",
  roles: ["manager"],
  merchant_id: "merchant-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

const operationalUser: User = {
  id: "operational-1",
  email: "operation-test@cymonevo.com",
  name: "Operational Test",
  roles: ["operational"],
  merchant_id: "merchant-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

function mockAuthUser(user: User) {
  vi.mocked(useAuth).mockReturnValue({
    user,
    merchant: { id: "merchant-1", name: "Test Merchant" },
    isLoading: false,
    isAuthenticated: true,
    isAdmin: user.roles.includes("admin"),
    login: vi.fn(),
    register: vi.fn(),
    registerMerchant: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  });
}

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
    mockAuthUser(operationalUser);
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
      screen.getByRole("columnheader", { name: "Stock Available" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Created by" }),
    ).toBeInTheDocument();
  });

  it("links to the new production request page for managers", async () => {
    mockAuthUser(managerUser);
    render(<AdminProductionRequestsPage />);
    await screen.findByText("manager1");

    expect(
      screen.getByRole("link", { name: "New production request" }),
    ).toHaveAttribute("href", "/admin/production-requests/new");
  });

  it("hides the new production request link for operational-only users", async () => {
    mockAuthUser(operationalUser);
    render(<AdminProductionRequestsPage />);
    await screen.findByText("manager1");

    expect(
      screen.queryByRole("link", { name: "New production request" }),
    ).not.toBeInTheDocument();
  });

  it("shows create button for users with both manager and operational roles", async () => {
    mockAuthUser({ ...managerUser, roles: ["manager", "operational"] });
    render(<AdminProductionRequestsPage />);
    await screen.findByText("manager1");

    expect(
      screen.getByRole("link", { name: "New production request" }),
    ).toHaveAttribute("href", "/admin/production-requests/new");
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
