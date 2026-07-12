import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./login-form";
import { ApiError } from "@/lib/api/client";
import type { User } from "@/lib/api/types";
import { toast } from "sonner";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockLogin = vi.fn();
const mockLogout = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => ({
    login: mockLogin,
    logout: mockLogout,
  }),
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
  role: "admin",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const regularUser: User = {
  id: "user-1",
  email: "user@example.com",
  name: "Regular User",
  role: "user",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

async function submitLogin(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Email"), "admin@example.com");
  await user.type(screen.getByLabelText("Password"), "secret123");
  await user.click(screen.getByRole("button", { name: "Login" }));
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects admin users to /admin after successful admin login", async () => {
    mockLogin.mockResolvedValue(adminUser);
    const user = userEvent.setup();

    render(<LoginForm variant="admin" />);
    await submitLogin(user);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: "admin@example.com",
        password: "secret123",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Welcome back, Admin User");
    expect(mockPush).toHaveBeenCalledWith("/admin");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("denies non-admin users on the admin login form", async () => {
    mockLogin.mockResolvedValue(regularUser);
    const user = userEvent.setup();

    render(<LoginForm variant="admin" />);
    await submitLogin(user);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
    expect(toast.error).toHaveBeenCalledWith(
      "This account does not have admin access.",
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("redirects regular users to /dashboard after user login", async () => {
    mockLogin.mockResolvedValue(regularUser);
    const user = userEvent.setup();

    render(<LoginForm variant="user" />);
    await submitLogin(user);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows invalid-credentials message on 401", async () => {
    mockLogin.mockRejectedValue(
      new ApiError(401, "unauthorized", "invalid credentials"),
    );
    const user = userEvent.setup();

    render(<LoginForm variant="admin" />);
    await submitLogin(user);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("invalid credentials");
    });
  });

  it("shows network error message when the API is unreachable", async () => {
    mockLogin.mockRejectedValue(
      new ApiError(
        0,
        "network_error",
        "Cannot reach the API. Check your connection or try again later.",
      ),
    );
    const user = userEvent.setup();

    render(<LoginForm variant="admin" />);
    await submitLogin(user);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Cannot reach the API. Check your connection or try again later.",
      );
    });
  });
});
