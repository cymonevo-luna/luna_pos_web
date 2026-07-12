import Link from "next/link";
import { config } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <p>
          © {new Date().getFullYear()} {config.appName}. All rights reserved.
        </p>
        <div className="flex flex-wrap justify-center gap-6">
          <Link href="/#features" className="hover:text-foreground">
            Features
          </Link>
          <Link href="/#pos-app" className="hover:text-foreground">
            POS App
          </Link>
          <Link href="/about" className="hover:text-foreground">
            About
          </Link>
          <Link href="/login" className="hover:text-foreground">
            Sign in
          </Link>
          <Link href="/register" className="hover:text-foreground">
            Register
          </Link>
        </div>
      </div>
    </footer>
  );
}
