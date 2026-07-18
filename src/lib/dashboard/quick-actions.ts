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
  Wallet,
} from "lucide-react";

export type OverviewCard = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  feature: string;
};

export const overviewCards: OverviewCard[] = [
  {
    title: "User management",
    description: "View, search, and manage merchant users.",
    href: "/admin/users",
    icon: Users,
    feature: "users.manage",
  },
  {
    title: "Menu breakdown",
    description: "Review cost of goods sold and menu margins.",
    href: "/admin/cogs/menu-breakdown",
    icon: Calculator,
    feature: "cogs.view",
  },
  {
    title: "User transactions",
    description: "Browse transaction history and details.",
    href: "/admin/transactions",
    icon: Receipt,
    feature: "transactions.view",
  },
  {
    title: "Cash flow",
    description: "Review inflows, menu sales, and production insights.",
    href: "/admin/cash-flow",
    icon: TrendingUp,
    feature: "insights.cash_flow",
  },
  {
    title: "Recurring expenses",
    description: "Manage scheduled recurring expense templates.",
    href: "/admin/recurring-expenses",
    icon: Repeat,
    feature: "recurring_expenses.manage",
  },
  {
    title: "Cashier balance",
    description: "View balance and record manual adjustments.",
    href: "/admin/cashier-balance",
    icon: Wallet,
    feature: "cashier_balance.manage",
  },
  {
    title: "Menus",
    description: "Manage menu items and formulas.",
    href: "/admin/menus",
    icon: UtensilsCrossed,
    feature: "menus.manage",
  },
  {
    title: "Categories",
    description: "Organize menu categories.",
    href: "/admin/categories",
    icon: Tags,
    feature: "categories.manage",
  },
  {
    title: "Ingredients",
    description: "Maintain ingredient inventory.",
    href: "/admin/food-supplies",
    icon: Package,
    feature: "food_supplies.manage",
  },
  {
    title: "Branch assets",
    description: "Manage branch equipment and inventory.",
    href: "/admin/branch-assets",
    icon: Box,
    feature: "branch_assets.manage",
  },
  {
    title: "Receipt settings",
    description: "Configure store receipt layout.",
    href: "/admin/store-settings",
    icon: Printer,
    feature: "store_settings.manage",
  },
  {
    title: "Suppliers",
    description: "Manage supplier contacts and pricing.",
    href: "/admin/suppliers",
    icon: Truck,
    feature: "suppliers.manage",
  },
  {
    title: "Purchase requests",
    description: "Create and track purchase requests.",
    href: "/admin/purchases",
    icon: ShoppingCart,
    feature: "purchases.manage",
  },
  {
    title: "Cook request",
    description: "Review and approve production requests.",
    href: "/admin/production-requests",
    icon: ChefHat,
    feature: "production_requests.view",
  },
];
