"use client";

import { Banknote, Receipt, TrendingUp } from "lucide-react";
import { useTransactionSummaryQuery } from "@/lib/query/hooks/use-transaction-summary";
import { getPresetDateRange } from "@/lib/query/date-range";
import {
  sumBucketAmounts,
  sumBucketCounts,
} from "@/lib/transactions/summary-helpers";
import { formatRupiah } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const PLACEHOLDER = "—";

function StatCardSkeleton() {
  return (
    <Card className="p-4" data-testid="summary-stat-skeleton">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="mt-3 h-8 w-24" />
      <Skeleton className="mt-2 h-4 w-32" />
    </Card>
  );
}

function formatTransactionCount(count: number): string {
  return `${count} transactions`;
}

export function TransactionSummaryStats() {
  const todayRange = getPresetDateRange("today");
  const weekRange = getPresetDateRange("week");
  const monthRange = getPresetDateRange("month");

  const todaySummary = useTransactionSummaryQuery({
    period: "daily",
    dateFrom: todayRange.dateFrom,
    dateTo: todayRange.dateTo,
  });
  const weekSummary = useTransactionSummaryQuery({
    period: "daily",
    dateFrom: weekRange.dateFrom,
    dateTo: weekRange.dateTo,
  });
  const monthSummary = useTransactionSummaryQuery({
    period: "daily",
    dateFrom: monthRange.dateFrom,
    dateTo: monthRange.dateTo,
  });

  const loading =
    todaySummary.isLoading || weekSummary.isLoading || monthSummary.isLoading;

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  const todayBuckets = todaySummary.data?.data?.buckets;
  const weekBuckets = weekSummary.data?.data?.buckets;
  const monthBuckets = monthSummary.data?.data?.buckets;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        label="Today"
        value={
          todaySummary.isError
            ? PLACEHOLDER
            : formatRupiah(sumBucketAmounts(todayBuckets))
        }
        subtitle={
          todaySummary.isError
            ? PLACEHOLDER
            : formatTransactionCount(sumBucketCounts(todayBuckets))
        }
        icon={Banknote}
        color="green"
      />
      <StatCard
        label="This week"
        value={
          weekSummary.isError
            ? PLACEHOLDER
            : formatRupiah(sumBucketAmounts(weekBuckets))
        }
        subtitle={
          weekSummary.isError
            ? PLACEHOLDER
            : formatTransactionCount(sumBucketCounts(weekBuckets))
        }
        icon={Receipt}
        color="blue"
      />
      <StatCard
        label="This month"
        value={
          monthSummary.isError
            ? PLACEHOLDER
            : formatRupiah(sumBucketAmounts(monthBuckets))
        }
        subtitle={
          monthSummary.isError
            ? PLACEHOLDER
            : formatTransactionCount(sumBucketCounts(monthBuckets))
        }
        icon={TrendingUp}
        color="purple"
      />
    </div>
  );
}
