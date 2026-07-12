import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About Luna POS",
  description:
    "Luna POS is a point-of-sale and back-office platform for food and retail merchants — web admin, API, and mobile cashier app.",
};

const components = [
  {
    name: "Web admin",
    description:
      "Manage menus, inventory, suppliers, purchases, and store settings from your browser.",
  },
  {
    name: "API",
    description:
      "The central backend that keeps your store data in sync across every device.",
  },
  {
    name: "Mobile cashier app",
    description:
      "Ring up sales, accept payments, and serve customers on the shop floor.",
  },
];

const gettingStarted = [
  "Register your merchant account",
  "Configure your store in the web admin",
  "Download the POS app on your devices",
  "Sign in as a cashier and start selling",
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20">
      <h1 className="text-4xl font-bold tracking-tight">About Luna POS</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Luna POS is a point-of-sale and back-office platform built for food and
        retail merchants. Run daily sales on the floor while managing menus,
        stock, and operations from one connected system.
      </p>

      <h2 className="mt-12 text-2xl font-semibold">What&apos;s included</h2>
      <ul className="mt-6 space-y-4">
        {components.map((item) => (
          <li
            key={item.name}
            className="rounded-xl border border-border px-5 py-4"
          >
            <p className="font-medium">{item.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.description}
            </p>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-2xl font-semibold">How it fits together</h2>
      <div
        className="mt-6 rounded-xl border border-border bg-secondary/40 p-6 text-sm"
        role="img"
        aria-label="Luna POS architecture: web admin, API, and mobile cashier app"
      >
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <div className="rounded-lg border border-border bg-background px-4 py-2 text-center font-medium">
            Web admin
          </div>
          <span className="text-muted-foreground" aria-hidden="true">
            ↔
          </span>
          <div className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-center font-medium">
            API
          </div>
          <span className="text-muted-foreground" aria-hidden="true">
            ↔
          </span>
          <div className="rounded-lg border border-border bg-background px-4 py-2 text-center font-medium">
            Mobile cashier app
          </div>
        </div>
      </div>

      <h2 className="mt-12 text-2xl font-semibold">Get started</h2>
      <ol className="mt-6 list-decimal space-y-2 pl-5 text-muted-foreground">
        {gettingStarted.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Link href="/register" className={buttonVariants({ size: "lg" })}>
          Register your merchant
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Back to home
        </Link>
        <Link
          href="/#features"
          className={buttonVariants({ variant: "ghost", size: "lg" })}
        >
          View features
        </Link>
      </div>
    </div>
  );
}
