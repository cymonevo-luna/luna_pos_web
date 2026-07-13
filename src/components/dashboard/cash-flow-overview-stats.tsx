"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Scale } from "lucide-react";
import { cashFlowAdminApi } from "@/lib/api/cash-flow";
import { ApiError } from "@/lib/api/client";
import type { CashFlowSummaryTotals } from "@/lib/api/types";
import { formatRupiah } from "@/lib/utils";
import { toast } from "sonner";
import { StatCard } from "@/components/dashboard/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const PLACEHOLDER = "—";
const CARD_COUNT = 3;

function formatDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTransactionCount(count: number): string {
  return `${count} ${count === 1 ? "transaction" : "transactions"}`;
}

function formatPaymentCount(count: number): string {
  return `${count} ${count === 1 ? "payment" : "payments"}`;
}

function StatCardSkeleton() {
  return (
    <Card className="p-4" data-testid="cash-flow-overview-stat-skeleton">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="mt-3 h-8 w-24" />
      <Skeleton className="mt-2 h-4 w-32" />
    </Card>
  );
}

export function CashFlowOverviewStats() {
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState<CashFlowSummaryTotals | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const today = formatDateInput(new Date());

      try {
        const res = await cashFlowAdminApi.summary({
          period: "daily",
          dateFrom: today,
          dateTo: today,
        });
        if (!cancelled) {
          setTotals(res.data?.totals ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof ApiError
              ? err.message
              : "Failed to load cash flow summary",
          );
          setTotals(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-3" data-testid="cash-flow-overview-stats">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">
            Cash flow
          </h3>
          <Link
            href="/admin/cash-flow"
            className="text-sm font-medium text-primary hover:underline"
          >
            View details →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: CARD_COUNT }, (_, index) => (
            <StatCardSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  const inflowAmount = totals?.inflow_amount;
  const outflowAmount = totals?.outflow_amount;
  const netAmount = totals?.net_amount;
  const netColor =
    netAmount == null ? "blue" : netAmount >= 0 ? "green" : "red";

  return (
    <div className="space-y-3" data-testid="cash-flow-overview-stats">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Cash flow</h3>
        <Link
          href="/admin/cash-flow"
          className="text-sm font-medium text-primary hover:underline"
        >
          View details →
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Today's Inflow"
          value={
            inflowAmount == null ? PLACEHOLDER : formatRupiah(inflowAmount)
          }
          subtitle={
            totals == null
              ? undefined
              : formatTransactionCount(totals.inflow_count)
          }
          icon={ArrowDownLeft}
          color="green"
        />
        <StatCard
          label="Today's Outflow"
          value={
            outflowAmount == null ? PLACEHOLDER : formatRupiah(outflowAmount)
          }
          subtitle={
            totals == null ? undefined : formatPaymentCount(totals.outflow_count)
          }
          icon={ArrowUpRight}
          color="amber"
        />
        <StatCard
          label="Today's Net Cash Flow"
          value={netAmount == null ? PLACEHOLDER : formatRupiah(netAmount)}
          icon={Scale}
          color={netColor}
        />
      </div>
    </div>
  );
}
