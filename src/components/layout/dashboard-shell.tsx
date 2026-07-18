"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import { Bell, ChevronDown, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/brand/logo";
import { BottomNav } from "@/components/layout/bottom-nav";
import type { MerchantRole } from "@/lib/api/types";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  roles?: MerchantRole[];
}

export interface NavGroup {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  children: NavItem[];
  roles?: MerchantRole[];
  defaultOpen?: boolean;
}

export type NavEntry = NavItem | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry;
}

function isNavLinkActive(
  pathname: string,
  href: string,
  siblingHrefs: string[] = [],
): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  if (pathname === href) {
    return true;
  }
  const hasMoreSpecificSibling = siblingHrefs.some(
    (other) => other !== href && other.startsWith(`${href}/`),
  );
  if (hasMoreSpecificSibling) {
    return false;
  }
  return pathname.startsWith(`${href}/`);
}

function isGroupActive(pathname: string, group: NavGroup): boolean {
  const siblingHrefs = group.children.map((child) => child.href);
  return group.children.some((child) =>
    isNavLinkActive(pathname, child.href, siblingHrefs),
  );
}

interface DashboardShellProps {
  navItems: NavEntry[];
  title: string;
  children: React.ReactNode;
}

export function DashboardShell({
  navItems,
  title,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenGroups((current) => {
      const next = { ...current };
      for (const entry of navItems) {
        if (!isNavGroup(entry)) continue;
        if (entry.defaultOpen || isGroupActive(pathname, entry)) {
          next[entry.label] = true;
        }
      }
      return next;
    });
  }, [pathname, navItems]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const toggleGroup = (label: string) => {
    setOpenGroups((current) => ({
      ...current,
      [label]: !current[label],
    }));
  };

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform border-r border-border bg-card transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <Link href="/">
            <Logo />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((entry) => {
            if (isNavGroup(entry)) {
              const groupActive = isGroupActive(pathname, entry);
              const expanded = openGroups[entry.label] ?? false;
              const GroupIcon = entry.icon;
              const siblingHrefs = entry.children.map((child) => child.href);

              return (
                <div key={entry.label} className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => toggleGroup(entry.label)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
                      groupActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                    aria-expanded={expanded}
                  >
                    {GroupIcon ? (
                      <GroupIcon className="h-4 w-4 shrink-0" />
                    ) : (
                      <span className="h-4 w-4 shrink-0" />
                    )}
                    <span className="flex-1">{entry.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform",
                        expanded ? "rotate-0" : "-rotate-90",
                      )}
                    />
                  </button>
                  {expanded ? (
                    <div className="ml-4 flex flex-col gap-0.5 border-l border-border pl-2">
                      {entry.children.map((child) => {
                        const active = isNavLinkActive(
                          pathname,
                          child.href,
                          siblingHrefs,
                        );
                        const ChildIcon = child.icon;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                              active
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                            )}
                          >
                            <ChildIcon className="h-4 w-4" />
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            }

            const active = isNavLinkActive(pathname, entry.href);
            const Icon = entry.icon;
            return (
              <Link
                key={entry.href}
                href={entry.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {entry.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">{title}</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              className="relative"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-destructive" />
            </Button>
            <ThemeToggle />
            {user ? (
              <div className="ml-1 flex items-center gap-2">
                <Avatar name={user.name} className="h-9 w-9" />
                <div className="hidden text-sm leading-tight sm:block">
                  <p className="font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              aria-label="Log out"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8">{children}</main>
      </div>

      <BottomNav items={navItems} />
    </div>
  );
}
