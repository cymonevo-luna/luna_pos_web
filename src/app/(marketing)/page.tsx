import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Palette,
  LayoutDashboard,
  Lock,
  Zap,
  Code2,
} from "lucide-react";
import { PosAppSection } from "@/components/landing/pos-app-section";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CtaSection } from "@/components/landing/cta-section";

export const metadata: Metadata = {
  description:
    "Modern point-of-sale for restaurants and retail — web admin, inventory, COGS, and a native cashier app.",
};

const features = [
  {
    icon: Lock,
    title: "JWT Authentication",
    description:
      "Login, register, and automatic token refresh wired to the Go backend out of the box.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    description:
      "Middleware-protected routes with separate user and admin areas based on JWT claims.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboards",
    description:
      "Ready-made user dashboard and admin console with a responsive sidebar layout.",
  },
  {
    icon: Palette,
    title: "Theming",
    description:
      "Light and dark mode with design tokens powered by CSS variables and Tailwind v4.",
  },
  {
    icon: Zap,
    title: "Typed API client",
    description:
      "A small fetch wrapper that understands the backend response envelope and errors.",
  },
  {
    icon: Code2,
    title: "Tested foundation",
    description:
      "Vitest and Testing Library configured so you can ship with confidence.",
  },
];

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

      <section id="features" className="mx-auto max-w-6xl px-4 pb-24">
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
      </section>

      <PosAppSection />
      <CtaSection />
    </div>
  );
}
