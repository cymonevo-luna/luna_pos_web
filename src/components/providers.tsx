"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { SessionActivityMonitor } from "@/components/auth/session-activity-monitor";
import { AuthProvider } from "@/lib/auth/context";
import { QueryProvider } from "@/lib/query/provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryProvider>
        <AuthProvider>
          <SessionActivityMonitor />
          {children}
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
