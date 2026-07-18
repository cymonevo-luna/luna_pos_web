import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { config } from "@/lib/config";
import { geistMono, geistSans } from "@/lib/fonts";

export const metadata: Metadata = {
  title: {
    default: config.appName,
    template: `%s · ${config.appName}`,
  },
  description:
    "Modern point-of-sale for restaurants and retail — web admin, inventory, COGS, and a native cashier app.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
