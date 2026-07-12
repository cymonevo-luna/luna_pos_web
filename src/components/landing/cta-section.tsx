import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const headlineId = "landing-cta-heading";

export function CtaSection() {
  return (
    <section
      aria-labelledby={headlineId}
      className="bg-primary text-primary-foreground"
    >
      <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:py-24">
        <h2
          id={headlineId}
          className="text-balance text-3xl font-bold tracking-tight sm:text-4xl"
        >
          Ready to modernize your point of sale?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-lg text-primary-foreground/90">
          Merchant registration is free. Set up dedicated roles for managers,
          cashiers, and operations so every teammate signs in with the right
          access from day one.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/register"
            className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
          >
            Create merchant account
          </Link>
          <Link
            href="/admin/login"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground",
            )}
          >
            Admin sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
