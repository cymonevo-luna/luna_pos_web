import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  Package,
  Printer,
  Receipt,
  ShieldCheck,
  UtensilsCrossed,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    icon: UtensilsCrossed,
    title: "Menu & categories",
    description:
      "Create menu items with photos, descriptions, and pricing. Organize offerings into categories your staff can browse at the register.",
  },
  {
    icon: Package,
    title: "Inventory & suppliers",
    description:
      "Track food supplies, maintain supplier contacts and pricing, and submit purchase requests when stock runs low.",
  },
  {
    icon: Calculator,
    title: "COGS & margins",
    description:
      "See ingredient costs and margin status per menu item. Export COGS data to CSV for deeper analysis.",
  },
  {
    icon: Receipt,
    title: "Transactions & reporting",
    description:
      "Review sales history with filters by date and payment method. View revenue summaries over daily, weekly, or monthly periods.",
  },
  {
    icon: ShieldCheck,
    title: "Multi-role access",
    description:
      "Assign Admin, Manager, Operational, or Cashier roles so each team member sees only the tools they need.",
  },
  {
    icon: Printer,
    title: "Store settings",
    description:
      "Configure brand name, branch details, and receipt header and footer text printed from the POS app.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 pb-24">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Everything you need to run your business
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Luna POS connects your register, admin console, and backend so you can
          manage menus, costs, and sales in one place.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.title}>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="mt-2">{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <div className="mt-10 flex justify-center">
        <Link
          href="/admin/login"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Open admin console
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
