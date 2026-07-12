import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./login-form";
import { ApiError } from "@/lib/api/client";
import { MERCHANT_REQUIRED_CODE } from "@/lib/api/auth";
import { sessionStore } from "@/lib/auth/session-store";
import { tokenStore } from "@/lib/auth/tokens";

const login = vi.fn();
const logout = vi.fn();
const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => ({
    login,
    logout,
  }),
}));

vi.mock("@/components/auth/social-buttons", () => ({
  SocialButtons: () => <div>Social</div>,
}));

describe("LoginForm", () => {
  it("links to merchant registration from the login page", () => {
    render(<LoginForm variant="user" />);

    const link = screen.getByRole("link", { name: "Register your merchant" });
    expect(link).toHaveAttribute("href", "/register");
    expect(screen.queryByRole("link", { name: "Register" })).not.toBeInTheDocument();
  });

  it("does not show user self-registration on admin login", () => {
    render(<LoginForm variant="admin" />);
    expect(screen.queryByRole("link", { name: /register/i })).not.toBeInTheDocument();
  });

  it("stores multi-role session data on successful login", async () => {
    const user = userEvent.setup();
    login.mockResolvedValue({
      id: "user-1",
      name: "Manager",
      email: "manager@example.com",
      roles: ["manager", "operational"],
      merchant_id: "merchant-1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });

    render(<LoginForm variant="user" />);
    await user.type(screen.getByLabelText("Email"), "manager@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(login).toHaveBeenCalledWith({
      email: "manager@example.com",
      password: "password123",
    });
    expect(push).toHaveBeenCalled();
  });

  it("shows merchant selector when login requires merchant_id", async () => {
    const user = userEvent.setup();
    login.mockRejectedValueOnce(
      new ApiError(400, MERCHANT_REQUIRED_CODE, "Select a merchant", undefined, {
        merchants: [
          { id: "merchant-1", name: "Luna Cafe" },
          { id: "merchant-2", name: "Luna Bistro" },
        ],
      }),
    );

    render(<LoginForm variant="user" />);
    await user.type(screen.getByLabelText("Email"), "owner@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(screen.getByLabelText("Merchant")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });
});

describe("auth session persistence", () => {
  it("persists roles and merchant context in session storage", () => {
    tokenStore.set("access-token", "refresh-token");
    sessionStore.set({
      user: {
        id: "user-1",
        email: "manager@example.com",
        name: "Manager",
        roles: ["manager", "operational"],
        merchant_id: "merchant-1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      merchant: { id: "merchant-1", name: "Luna Cafe" },
    });

    const session = sessionStore.get();
    expect(tokenStore.access).toBe("access-token");
    expect(session?.user.roles).toEqual(["manager", "operational"]);
    expect(session?.user.merchant_id).toBe("merchant-1");
    expect(session?.merchant.name).toBe("Luna Cafe");
  });
});
