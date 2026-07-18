"use client";

import { BranchAssetsNav } from "@/components/admin/branch-assets-nav";
import { BranchAssetsSummarySection } from "@/components/admin/branch-assets-summary-section";

export default function BranchAssetsSummaryPage() {
  return (
    <div className="space-y-6" data-testid="branch-assets-summary-page">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Branch assets summary
          </h1>
          <p className="text-muted-foreground">
            Total asset capital across branch assets.
          </p>
        </div>
        <BranchAssetsNav />
      </div>

      <BranchAssetsSummarySection />
    </div>
  );
}
