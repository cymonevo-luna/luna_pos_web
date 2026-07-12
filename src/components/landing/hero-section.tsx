import Link from "next/link";
import { ArrowRight, Smartphone, Store } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-primary/5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--color-primary)_0%,_transparent_50%)] opacity-[0.07]"
      />
      <div className="relative mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5 text-sm text-secondary-foreground">
          <Store className="h-4 w-4 text-primary" aria-hidden="true" />
          All-in-one POS platform
          <Smartphone
            className="h-4 w-4 text-primary sm:hidden"
            aria-hidden="true"
          />
        </span>

        <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Run your store from menu to receipt
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
          Manage menus, inventory, and COGS from the web admin while cashiers
          ring up orders on mobile. Luna POS keeps your back office and front
          line in sync.
        </p>

        <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Link
            href="/register"
            className={buttonVariants({ size: "lg" })}
          >
            Get started free
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/login"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
