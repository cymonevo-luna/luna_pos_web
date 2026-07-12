import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MarketingLayout from "./layout";

vi.mock("@/lib/auth/context", () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: false,
    isLoading: false,
  })),
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => null,
}));

vi.mock("@/components/brand/logo", () => ({
  Logo: () => <span>Luna POS</span>,
}));

describe("MarketingLayout", () => {
  it("renders header and footer around page content", () => {
    render(
      <MarketingLayout>
        <p>Page content</p>
      </MarketingLayout>,
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
    const footer = screen.getByRole("contentinfo");
    expect(footer).toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Features" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: "Register" })).toHaveAttribute(
      "href",
      "/register",
    );
  });
});
