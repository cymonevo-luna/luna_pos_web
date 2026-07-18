"use client";

import { BEPProjectionSection } from "@/components/admin/bep-projection-section";

export default function AdminCashFlowBepPage() {
  return (
    <div className="space-y-6" data-testid="cash-flow-bep-page">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Break-even projection
        </h1>
        <p className="text-muted-foreground">
          Historical break-even metrics and forward cash-flow projection based on
          recent averages.
        </p>
      </div>

      <BEPProjectionSection />
    </div>
  );
}
