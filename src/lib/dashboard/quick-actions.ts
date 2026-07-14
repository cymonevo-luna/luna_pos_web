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
    title: "COGS",
    description: "Review cost of goods sold and menu margins.",
    href: "/admin/cogs",
    icon: Calculator,
    roles: ["manager"],
  },
  {
    title: "Transactions",
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
    title: "Food supplies",
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
    title: "Production requests",
    description: "Review and approve production requests.",
    href: "/admin/production-requests",
    icon: ChefHat,
    roles: ["admin", "manager", "operational"],
  },
];
