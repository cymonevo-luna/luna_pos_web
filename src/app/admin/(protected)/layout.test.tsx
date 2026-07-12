import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminProtectedLayout from "./layout";

vi.mock("@/components/layout/require-auth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/layout/dashboard-shell", () => ({
  DashboardShell: ({
    navItems,
    children,
  }: {
    navItems: { href: string; label: string }[];
    children: React.ReactNode;
  }) => (
    <div>
      <nav>
        {navItems.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
      {children}
    </div>
  ),
}));

describe("AdminProtectedLayout", () => {
  it("includes Suppliers in admin navigation", () => {
    render(
      <AdminProtectedLayout>
        <div>Page content</div>
      </AdminProtectedLayout>,
    );

    const link = screen.getByRole("link", { name: "Suppliers" });
    expect(link).toHaveAttribute("href", "/admin/suppliers");
  });

  it("includes COGS in admin navigation", () => {
    render(
      <AdminProtectedLayout>
        <div>Page content</div>
      </AdminProtectedLayout>,
    );

    const link = screen.getByRole("link", { name: "COGS" });
    expect(link).toHaveAttribute("href", "/admin/cogs");
  });
});
