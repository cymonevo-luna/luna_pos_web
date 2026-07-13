"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const tabs = [
  { href: "/admin/branch-assets", label: "Assets" },
  { href: "/admin/branch-assets/summary", label: "Summary" },
] as const;

export function BranchAssetsNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap gap-2"
      aria-label="Branch assets"
      data-testid="branch-assets-nav"
    >
      {tabs.map((tab) => {
        const active =
          tab.href === "/admin/branch-assets"
            ? pathname === "/admin/branch-assets"
            : pathname === tab.href ||
              (pathname?.startsWith(`${tab.href}/`) ?? false);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              buttonVariants({
                variant: active ? "default" : "outline",
                size: "sm",
              }),
              active && "pointer-events-none",
            )}
            aria-current={active ? "page" : undefined}
          >
            {tab.label === "Assets" ? (
              <Building2 className="mr-2 h-4 w-4" />
            ) : null}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
