import Link from "next/link";
import {
  Download,
  Printer,
  Receipt,
  ShoppingCart,
  Smartphone,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { config } from "@/lib/config";
import { cn } from "@/lib/utils";
import { PosAppMockup } from "./pos-app-mockup";

const features = [
  {
    icon: Smartphone,
    title: "Cashier login",
    description: "Secure sign-in for front-of-house staff on any Android device.",
  },
  {
    icon: ShoppingCart,
    title: "Browse menu & add to cart",
    description: "Tap through categories, customize items, and build orders fast.",
  },
  {
    icon: Printer,
    title: "Checkout & receipt printing",
    description: "Take payment and print receipts from the same handheld flow.",
  },
  {
    icon: Receipt,
    title: "Transaction history",
    description: "Review past sales and reprint receipts when customers need them.",
  },
] as const;

export function PosAppSection() {
  const downloadUrl = config.posAppDownloadUrl.trim();
  const hasDownloadUrl = downloadUrl.length > 0;

  return (
    <section
      id="pos-app"
      className="border-t border-border bg-secondary/30 py-20 sm:py-24"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-primary">
            Luna POS Mobile
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Run the register from your Android device
          </h2>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            The Luna POS cashier app brings the full in-store workflow to a
            phone or tablet — built for speed at the counter and synced with
            your Luna web dashboard.
          </p>

          <ul className="mt-8 space-y-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <li key={feature.title} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div>
                    <p className="font-medium">{feature.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            {hasDownloadUrl ? (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ size: "lg" }))}
              >
                <Download className="h-4 w-4" aria-hidden />
                Download POS App
              </a>
            ) : (
              <Button size="lg" disabled aria-disabled="true">
                <Download className="h-4 w-4" aria-hidden />
                Download POS App
              </Button>
            )}

            <Link
              href="/login"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Cashier sign in
            </Link>
          </div>

          {!hasDownloadUrl ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Available for Android — contact your administrator
            </p>
          ) : null}
        </div>

        <div className="flex justify-center lg:justify-end">
          <PosAppMockup />
        </div>
      </div>
    </section>
  );
}
