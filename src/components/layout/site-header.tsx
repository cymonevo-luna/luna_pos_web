"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/context";
import { Logo } from "@/components/brand/logo";

const navLinks = [
  { href: "/#features", label: "Features" },
  { href: "/#pos-app", label: "POS App" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!isLoading && isAuthenticated ? (
            <Link
              href="/dashboard"
              className={buttonVariants({ size: "sm" })}
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className={buttonVariants({ size: "sm" })}
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
