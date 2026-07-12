import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginForm } from "./login-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => ({
    login: vi.fn(),
    logout: vi.fn(),
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
  });
});
