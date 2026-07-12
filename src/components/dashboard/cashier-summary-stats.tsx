"use client";

import { useEffect, useState } from "react";
import { Banknote, Receipt } from "lucide-react";
import { transactionsPosApi } from "@/lib/api/pos-transactions";
import { formatRupiah } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const PLACEHOLDER = "—";

function formatDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sumBucketAmounts(
  buckets: { total_amount: number }[] | undefined,
): number {
  return (buckets ?? []).reduce((sum, bucket) => sum + bucket.total_amount, 0);
}

function sumBucketCounts(buckets: { count: number }[] | undefined): number {
  return (buckets ?? []).reduce((sum, bucket) => sum + bucket.count, 0);
}

function StatCardSkeleton() {
  return (
    <Card className="p-4" data-testid="cashier-summary-stat-skeleton">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="mt-3 h-8 w-24" />
      <Skeleton className="mt-2 h-4 w-32" />
    </Card>
  );
}

export function CashierSummaryStats() {
  const [loading, setLoading] = useState(true);
  const [todayRevenue, setTodayRevenue] = useState<number | null>(null);
  const [todayTransactions, setTodayTransactions] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const today = formatDateInput(new Date());

      try {
        const res = await transactionsPosApi.summary({
          period: "daily",
          dateFrom: today,
          dateTo: today,
        });
        if (cancelled) return;
        const buckets = res.data?.buckets;
        setTodayRevenue(sumBucketAmounts(buckets));
        setTodayTransactions(sumBucketCounts(buckets));
      } catch {
        if (cancelled) return;
        setTodayRevenue(null);
        setTodayTransactions(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <StatCard
        label="Today's revenue"
        value={
          todayRevenue == null ? PLACEHOLDER : formatRupiah(todayRevenue)
        }
        icon={Banknote}
        color="green"
      />
      <StatCard
        label="Today's transactions"
        value={
          todayTransactions == null ? PLACEHOLDER : todayTransactions
        }
        icon={Receipt}
        color="blue"
      />
    </div>
  );
}
