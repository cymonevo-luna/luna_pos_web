"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  isNavGroup,
  type NavEntry,
  type NavItem,
} from "@/components/layout/dashboard-shell";

function isNavLinkActive(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  return (
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(`${href}/`))
  );
}

export function getBottomNavItems(items: NavEntry[]): NavItem[] {
  return items.filter((entry): entry is NavItem => !isNavGroup(entry));
}

export function BottomNav({ items }: { items: NavEntry[] }) {
  const pathname = usePathname();
  const topLevelItems = getBottomNavItems(items);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-md items-center justify-around px-2">
        {topLevelItems.map((item) => {
          const active = isNavLinkActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
