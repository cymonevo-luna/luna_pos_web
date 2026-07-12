import type { Metadata } from "next";
import { FeaturesSection } from "@/components/landing/features-section";
import { HeroSection } from "@/components/landing/hero-section";
import { PosAppSection } from "@/components/landing/pos-app-section";
import { CtaSection } from "@/components/landing/cta-section";

export const metadata: Metadata = {
  title: "Luna POS",
  description:
    "Modern point-of-sale for restaurants and retail — web admin, inventory, COGS, and a native cashier app.",
};

export default function HomePage() {
  return (
    <div>
      <HeroSection />
      <FeaturesSection />
      <PosAppSection />
      <CtaSection />
    </div>
  );
}
