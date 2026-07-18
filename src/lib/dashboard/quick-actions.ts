import {
  Users,
  Calculator,
  Receipt,
  Truck,
  ShoppingCart,
  UtensilsCrossed,
  Tags,
  Package,
  Box,
  Printer,
  ChefHat,
  TrendingUp,
  Repeat,
} from "lucide-react";
import type { MerchantRole } from "@/lib/api/types";

export type OverviewCard = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: MerchantRole[];
};

export const overviewCards: OverviewCard[] = [
  {
    title: "User management",
    description: "View, search, and manage merchant users.",
    href: "/admin/users",
    icon: Users,
    roles: ["admin"],
  },
  {
    title: "Menu breakdown",
    description: "Review cost of goods sold and menu margins.",
    href: "/admin/cogs/menu-breakdown",
    icon: Calculator,
    roles: ["manager"],
  },
  {
    title: "User transactions",
    description: "Browse transaction history and details.",
    href: "/admin/transactions",
    icon: Receipt,
    roles: ["manager"],
  },
  {
    title: "Cash flow",
    description: "Review inflows, menu sales, and production insights.",
    href: "/admin/cash-flow",
    icon: TrendingUp,
    roles: ["manager"],
  },
  {
    title: "Recurring expenses",
    description: "Manage scheduled recurring expense templates.",
    href: "/admin/recurring-expenses",
    icon: Repeat,
    roles: ["manager", "operational"],
  },
  {
    title: "Menus",
    description: "Manage menu items and formulas.",
    href: "/admin/menus",
    icon: UtensilsCrossed,
    roles: ["manager"],
  },
  {
    title: "Categories",
    description: "Organize menu categories.",
    href: "/admin/categories",
    icon: Tags,
    roles: ["manager"],
  },
  {
    title: "Ingredients",
    description: "Maintain ingredient inventory.",
    href: "/admin/food-supplies",
    icon: Package,
    roles: ["manager", "operational"],
  },
  {
    title: "Branch assets",
    description: "Manage branch equipment and inventory.",
    href: "/admin/branch-assets",
    icon: Box,
    roles: ["manager"],
  },
  {
    title: "Receipt settings",
    description: "Configure store receipt layout.",
    href: "/admin/store-settings",
    icon: Printer,
    roles: ["manager"],
  },
  {
    title: "Suppliers",
    description: "Manage supplier contacts and pricing.",
    href: "/admin/suppliers",
    icon: Truck,
    roles: ["operational"],
  },
  {
    title: "Purchase requests",
    description: "Create and track purchase requests.",
    href: "/admin/purchases",
    icon: ShoppingCart,
    roles: ["operational"],
  },
  {
    title: "Cook request",
    description: "Review and approve production requests.",
    href: "/admin/production-requests",
    icon: ChefHat,
    roles: ["admin", "manager", "operational"],
  },
];
