"use client";

import { CashFlowSection } from "@/components/admin/cash-flow-section";
import { ProductionInsightPanel } from "@/components/admin/production-insight-panel";
import { TransactionMenuPieChart } from "@/components/admin/transaction-menu-pie-chart";

export default function AdminCashFlowPage() {
  return (
    <div className="space-y-6" data-testid="cash-flow-page">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cash flow</h1>
        <p className="text-muted-foreground">
          Cash movement, menu sales insights, and production recommendations.
        </p>
      </div>

      <CashFlowSection />
      <TransactionMenuPieChart />
      <ProductionInsightPanel />
    </div>
  );
}
