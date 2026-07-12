import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { FeaturesSection } from "@/components/landing/features-section";
import { PosAppSection } from "@/components/landing/pos-app-section";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  description:
    "Modern point-of-sale for restaurants and retail — web admin, inventory, COGS, and a native cashier app.",
};

export default function HomePage() {
  return (
    <div>
      <section className="mx-auto max-w-6xl px-4 py-24 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5 text-sm text-secondary-foreground">
          <Zap className="h-4 w-4 text-primary" />
          Next.js 16 · App Router · Tailwind v4
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-balance text-5xl font-bold tracking-tight sm:text-6xl">
          The starter for your next full-stack product
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          A batteries-included template with authentication, a public marketing
          site, and protected user and admin dashboards — ready to connect to
          your API.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/register"
            className={buttonVariants({ size: "lg" })}
          >
            Get started
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/about"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Learn more
          </Link>
        </div>
      </section>

      <FeaturesSection />
      <PosAppSection />
    </div>
  );
}
