import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminProtectedLayout, { filterAdminNavItems } from "./layout";
import type { NavItem } from "@/components/layout/dashboard-shell";

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

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => ({
    user: { id: "1", roles: ["admin"], merchant_id: "merchant-1" },
  }),
}));

describe("AdminProtectedLayout", () => {
  it("includes Suppliers in admin navigation for manager users", () => {
    vi.doMock("@/lib/auth/context", () => ({
      useAuth: () => ({
        user: { id: "1", roles: ["admin", "manager"], merchant_id: "merchant-1" },
      }),
    }));

    const items: NavItem[] = [
      { href: "/admin/users", label: "Users", icon: () => null, roles: ["admin"] },
      {
        href: "/admin/suppliers",
        label: "Suppliers",
        icon: () => null,
        roles: ["manager", "operational"],
      },
    ];

    expect(
      filterAdminNavItems(items, ["admin", "manager"]).some(
        (item) => item.label === "Suppliers",
      ),
    ).toBe(true);
  });

  it("hides operational navigation for admin-only users", () => {
    render(
      <AdminProtectedLayout>
        <div>Page content</div>
      </AdminProtectedLayout>,
    );

    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Suppliers" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Menus" })).not.toBeInTheDocument();
  });

  it("includes COGS in admin navigation for manager users", () => {
    const items: NavItem[] = [
      {
        href: "/admin/cogs",
        label: "COGS",
        icon: () => null,
        roles: ["manager", "operational"],
      },
    ];

    expect(
      filterAdminNavItems(items, ["admin", "manager"]).some(
        (item) => item.label === "COGS",
      ),
    ).toBe(true);
  });

  it("includes Receipt Settings for admin-only users", () => {
    render(
      <AdminProtectedLayout>
        <div>Page content</div>
      </AdminProtectedLayout>,
    );

    const link = screen.getByRole("link", { name: "Receipt Settings" });
    expect(link).toHaveAttribute("href", "/admin/store-settings");
  });
});
