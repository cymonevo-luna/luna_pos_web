"use client";

import { BranchAssetsNav } from "@/components/admin/branch-assets-nav";

export default function BranchAssetsPage() {
  return (
    <div className="space-y-6" data-testid="branch-assets-page">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Branch assets</h1>
          <p className="text-muted-foreground">
            Track branch equipment and capital assets.
          </p>
        </div>
        <BranchAssetsNav />
      </div>

      <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
        Asset management list is available from this section. Open the Summary tab
        for capital totals and projected break-even.
      </div>
    </div>
  );
}
