import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminUsersPage from "./page";
import { adminApi } from "@/lib/api/users";
import { ApiError } from "@/lib/api/client";
import type { User } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";

vi.mock("@/lib/api/users", () => ({
  adminApi: {
    listUsers: vi.fn(),
    createUser: vi.fn(),
    updateUserRoles: vi.fn(),
    deleteUser: vi.fn(),
  },
  adminUserCreateFormToPayload: (values: unknown) => values,
  adminUserRolesFormToPayload: (values: unknown) => values,
}));

vi.mock("@/lib/auth/context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const adminUser: User = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin User",
  roles: ["admin"],
  merchant_id: "merchant-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

const cashierUser: User = {
  id: "cashier-1",
  email: "cashier@example.com",
  name: "Cashier User",
  roles: ["cashier"],
  merchant_id: "merchant-1",
  created_at: "2026-01-02T00:00:00Z",
  updated_at: "2026-01-16T00:00:00Z",
};

describe("AdminUsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: adminUser,
      merchant: { id: "merchant-1", name: "Test Merchant" },
      isLoading: false,
      isAuthenticated: true,
      isAdmin: true,
      login: vi.fn(),
      register: vi.fn(),
      registerMerchant: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
    vi.mocked(adminApi.listUsers).mockResolvedValue({
      data: [adminUser, cashierUser],
      meta: { page: 1, per_page: 10, total: 2 },
    });
  });

  it("renders users from the API with role badges", async () => {
    render(<AdminUsersPage />);

    expect(await screen.findByText("Admin User")).toBeInTheDocument();
    expect(screen.getByText("Cashier User")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Cashier")).toBeInTheDocument();
    expect(screen.getByText("2 total")).toBeInTheDocument();
  });

  it("creates a user with multiple roles", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.createUser).mockResolvedValue({
      data: {
        ...cashierUser,
        roles: ["cashier", "operational"],
      },
    });

    render(<AdminUsersPage />);
    await screen.findByText("Admin User");

    await user.click(screen.getByRole("button", { name: "Create user" }));
    await user.type(screen.getByLabelText("Email"), "ops@example.com");
    await user.type(screen.getByLabelText("Name"), "Ops User");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByLabelText("Cashier"));
    await user.click(screen.getByLabelText("Operational"));
    const submitButtons = screen.getAllByRole("button", { name: "Create user" });
    await user.click(submitButtons[submitButtons.length - 1]!);

    await waitFor(() => {
      expect(adminApi.createUser).toHaveBeenCalledWith({
        email: "ops@example.com",
        name: "Ops User",
        password: "password123",
        roles: ["cashier", "operational"],
      });
    });
  });

  it("updates roles and reloads the list", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.updateUserRoles).mockResolvedValue({
      data: { ...cashierUser, roles: ["manager"] },
    });

    render(<AdminUsersPage />);
    await screen.findByText("Cashier User");

    const editButtons = screen.getAllByLabelText("Edit roles");
    await user.click(editButtons[1]!);
    await user.click(screen.getByLabelText("Manager"));
    await user.click(screen.getByLabelText("Cashier"));
    await user.click(screen.getByRole("button", { name: "Save roles" }));

    await waitFor(() => {
      expect(adminApi.updateUserRoles).toHaveBeenCalledWith("cashier-1", {
        roles: ["manager"],
      });
      expect(adminApi.listUsers).toHaveBeenCalledTimes(2);
    });
  });

  it("shows API 409 errors when removing the last admin role", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");
    vi.mocked(adminApi.updateUserRoles).mockRejectedValue(
      new ApiError(
        409,
        "last_admin",
        "Cannot remove the last administrator from the merchant",
      ),
    );

    render(<AdminUsersPage />);
    await screen.findByText("Admin User");

    await user.click(screen.getAllByLabelText("Edit roles")[0]!);
    await user.click(screen.getByLabelText("Admin"));
    await user.click(screen.getByLabelText("Manager"));
    await user.click(screen.getByRole("button", { name: "Save roles" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Cannot remove the last administrator from the merchant",
      );
    });
  });

  it("removes a user after confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.deleteUser).mockResolvedValue({ data: undefined });

    render(<AdminUsersPage />);
    await screen.findByText("Cashier User");

    const removeButtons = screen.getAllByLabelText("Remove user");
    await user.click(removeButtons[1]!);
    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(adminApi.deleteUser).toHaveBeenCalledWith("cashier-1");
    });
  });
});
