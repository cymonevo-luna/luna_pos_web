import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteHeader } from "./site-header";

vi.mock("@/lib/auth/context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

vi.mock("@/components/brand/logo", () => ({
  Logo: () => <span>Luna POS</span>,
}));

import { useAuth } from "@/lib/auth/context";

describe("SiteHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
  });

  it("shows Luna nav links for unauthenticated users", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Features" })).toHaveAttribute(
      "href",
      "/#features",
    );
    expect(screen.getByRole("link", { name: "POS App" })).toHaveAttribute(
      "href",
      "/#pos-app",
    );
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
      "href",
      "/about",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "Get started" })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("shows Dashboard when authenticated", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);

    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Get started" }),
    ).not.toBeInTheDocument();
  });

  it("shows sign-in CTAs while auth is loading", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    } as ReturnType<typeof useAuth>);

    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get started" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
  });
});
