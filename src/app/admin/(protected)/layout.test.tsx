import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChefHat } from "lucide-react";
import AdminProtectedLayout, {
  allNavItems,
  filterAdminNavItems,
  flattenAdminNavLabels,
} from "./layout";
import { isNavGroup, type NavEntry, type NavItem } from "@/components/layout/dashboard-shell";

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
    navItems: NavEntry[];
    children: React.ReactNode;
  }) => (
    <div>
      <nav>
        {navItems.map((entry) =>
          isNavGroup(entry) ? (
            <div key={entry.label}>
              <span>{entry.label}</span>
              {entry.children.map((child) => (
                <a key={child.href} href={child.href}>
                  {child.label}
                </a>
              ))}
            </div>
          ) : (
            <a key={entry.href} href={entry.href}>
              {entry.label}
            </a>
          ),
        )}
      </nav>
      {children}
    </div>
  ),
  isNavGroup: (entry: NavEntry) => "children" in entry,
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
    expect(screen.getByRole("link", { name: "Staff" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "List" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Purchases" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Menu" })).not.toBeInTheDocument();
    expect(screen.queryByText("COGS")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Receipt Setting" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Assets" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Order Option" })).not.toBeInTheDocument();
  });

  it("includes Cash Flow group for manager users", () => {
    const managerLabels = flattenAdminNavLabels(
      filterAdminNavItems(allNavItems, ["manager"]),
    );
    const operationalLabels = flattenAdminNavLabels(
      filterAdminNavItems(allNavItems, ["operational"]),
    );

    expect(managerLabels).toContain("Cash Flow");
    expect(managerLabels).toContain("Summary");
    expect(managerLabels).toContain("BEP");
    expect(operationalLabels).toContain("Cash Flow");
    expect(operationalLabels).toContain("Expenses");
    expect(operationalLabels).not.toContain("Summary");
    expect(operationalLabels).not.toContain("BEP");
  });

  it("includes COGS group for manager users", () => {
    const labels = flattenAdminNavLabels(
      filterAdminNavItems(allNavItems, ["manager"]),
    );

    expect(labels).toContain("COGS");
    expect(labels).toContain("Menu Breakdown");
  });

  it("includes Ingredients for operational users", () => {
    const labels = flattenAdminNavLabels(
      filterAdminNavItems(allNavItems, ["operational"]),
    );

    expect(labels).toContain("Food");
    expect(labels).toContain("Ingredients");
    expect(labels).not.toContain("Menu");
    expect(labels).not.toContain("Categories");
    expect(labels).not.toContain("User Transactions");
    expect(labels).not.toContain("Branch");
  });

  it("includes operational items for operational users", () => {
    const labels = flattenAdminNavLabels(
      filterAdminNavItems(allNavItems, ["operational"]),
    );

    expect(labels).toContain("Supplier");
    expect(labels).toContain("List");
    expect(labels).toContain("Purchases");
    expect(labels).toContain("Expenses");
    expect(labels).toContain("Recurring Expenses");
    expect(labels).not.toContain("BEP");
    expect(labels).not.toContain("COGS");
  });

  it("shows combined nav for manager and operational users", () => {
    const labels = flattenAdminNavLabels(
      filterAdminNavItems(allNavItems, ["manager", "operational"]),
    );

    expect(labels).toContain("COGS");
    expect(labels).toContain("Purchases");
    expect(labels).toContain("Cook Request");
    expect(labels).not.toContain("New production request");
  });

  it("shows manager nav groups", () => {
    const filtered = filterAdminNavItems(allNavItems, ["manager"]);
    const groupLabels = filtered
      .filter((entry) => isNavGroup(entry))
      .map((entry) => entry.label);

    expect(groupLabels).toEqual(["Food", "COGS", "Cash Flow", "Branch"]);
  });

  it("shows manager Food group children in order", () => {
    const filtered = filterAdminNavItems(allNavItems, ["manager"]);
    const foodGroup = filtered.find(
      (entry) => isNavGroup(entry) && entry.label === "Food",
    );
    expect(foodGroup && isNavGroup(foodGroup)).toBe(true);
    if (!foodGroup || !isNavGroup(foodGroup)) {
      return;
    }

    expect(foodGroup.children.map((child) => child.label)).toEqual([
      "Ingredients",
      "Categories",
      "Menu",
      "Cook Request",
      "User Transactions",
    ]);
  });

  it("shows manager Branch group children in order", () => {
    const filtered = filterAdminNavItems(allNavItems, ["manager"]);
    const branchGroup = filtered.find(
      (entry) => isNavGroup(entry) && entry.label === "Branch",
    );
    expect(branchGroup && isNavGroup(branchGroup)).toBe(true);
    if (!branchGroup || !isNavGroup(branchGroup)) {
      return;
    }

    expect(branchGroup.children.map((child) => child.label)).toEqual([
      "Assets",
      "Order Option",
      "Receipt Setting",
    ]);
  });

  it("shows admin Branch group with Users and Staff only", () => {
    const filtered = filterAdminNavItems(allNavItems, ["admin"]);
    const branchGroup = filtered.find(
      (entry) => isNavGroup(entry) && entry.label === "Branch",
    );
    expect(branchGroup && isNavGroup(branchGroup)).toBe(true);
    if (!branchGroup || !isNavGroup(branchGroup)) {
      return;
    }

    expect(branchGroup.children.map((child) => child.label)).toEqual([
      "Users",
      "Staff",
    ]);
  });

  it("hides Supplier group for manager-only users", () => {
    const filtered = filterAdminNavItems(allNavItems, ["manager"]);
    const groupLabels = filtered
      .filter((entry) => isNavGroup(entry))
      .map((entry) => entry.label);
    const labels = flattenAdminNavLabels(filtered);

    expect(groupLabels).toEqual(["Food", "COGS", "Cash Flow"]);
    expect(labels).not.toContain("Supplier");
    expect(labels).not.toContain("List");
    expect(labels).not.toContain("Purchases");
  });

  it("filters empty groups when no children are visible", () => {
    const items: NavEntry[] = [
      {
        label: "COGS",
        icon: () => null,
        children: [
          {
            href: "/admin/cogs/menu-breakdown",
            label: "Menu Breakdown",
            icon: () => null,
            roles: ["manager"],
          },
        ],
      },
    ];

    expect(filterAdminNavItems(items, ["operational"])).toEqual([]);
  });

  it("uses ChefHat icon for Cook Request navigation", () => {
    const { container } = render(<ChefHat className="h-4 w-4" />);
    expect(container.querySelector("svg")).toHaveClass("lucide-chef-hat");
  });
});
