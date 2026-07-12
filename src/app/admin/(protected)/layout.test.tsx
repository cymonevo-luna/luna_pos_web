import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminProtectedLayout, { filterAdminNavItems } from "./layout";
import type { NavItem } from "@/components/layout/dashboard-shell";

vi.mock("@/components/layout/require-auth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/layout/admin-route-guard", () => ({
  AdminRouteGuard: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
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
  it("hides operational navigation for admin-only users", () => {
    render(
      <AdminProtectedLayout>
        <div>Page content</div>
      </AdminProtectedLayout>,
    );

    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Suppliers" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Purchases" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Menus" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "COGS" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Receipt Settings" })).not.toBeInTheDocument();
  });

  it("includes COGS for manager users", () => {
    const items: NavItem[] = [
      {
        href: "/admin/cogs",
        label: "COGS",
        icon: () => null,
        roles: ["manager"],
      },
    ];

    expect(
      filterAdminNavItems(items, ["manager"]).some(
        (item) => item.label === "COGS",
      ),
    ).toBe(true);
  });

  it("includes Food Supplies for operational users", () => {
    const items: NavItem[] = [
      {
        href: "/admin/food-supplies",
        label: "Food Supplies",
        icon: () => null,
        roles: ["manager", "operational"],
      },
    ];

    expect(
      filterAdminNavItems(items, ["operational"]).some(
        (item) => item.label === "Food Supplies",
      ),
    ).toBe(true);
  });

  it("includes operational items for operational users", () => {
    const items: NavItem[] = [
      {
        href: "/admin/suppliers",
        label: "Suppliers",
        icon: () => null,
        roles: ["operational"],
      },
      {
        href: "/admin/purchases",
        label: "Purchases",
        icon: () => null,
        roles: ["operational"],
      },
    ];

    expect(
      filterAdminNavItems(items, ["operational"]).map((item) => item.label),
    ).toEqual(["Suppliers", "Purchases"]);
  });

  it("shows combined nav for manager and operational users", () => {
    const items: NavItem[] = [
      {
        href: "/admin/cogs",
        label: "COGS",
        icon: () => null,
        roles: ["manager"],
      },
      {
        href: "/admin/purchases",
        label: "Purchases",
        icon: () => null,
        roles: ["operational"],
      },
    ];

    const labels = filterAdminNavItems(items, ["manager", "operational"]).map(
      (item) => item.label,
    );
    expect(labels).toContain("COGS");
    expect(labels).toContain("Purchases");
  });
});
