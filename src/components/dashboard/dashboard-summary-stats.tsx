"use client";

import { useMemo } from "react";
import {
  Banknote,
  Receipt,
  TrendingUp,
  Users,
  Truck,
  ShoppingCart,
} from "lucide-react";
import { useAdminUsersListQuery } from "@/lib/query/hooks/use-admin-users-list";
import {
  usePurchaseRequestsListQuery,
  useSuppliersListQuery,
} from "@/lib/query/hooks/use-operational-stats";
import { useTransactionSummaryQuery } from "@/lib/query/hooks/use-transaction-summary";
import {
  getDefaultTransactionDateRange,
  getTodayDateInput,
} from "@/lib/query/date-range";
import { formatRupiah } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const PLACEHOLDER = "—";

function sumBucketAmounts(
  buckets: { total_amount: number }[] | undefined,
): number {
  return (buckets ?? []).reduce((sum, bucket) => sum + bucket.total_amount, 0);
}

function sumBucketCounts(buckets: { count: number }[] | undefined): number {
  return (buckets ?? []).reduce((sum, bucket) => sum + bucket.count, 0);
}

interface DashboardSummaryStatsProps {
  features: string[];
}

function StatCardSkeleton() {
  return (
    <Card className="p-4" data-testid="summary-stat-skeleton">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="mt-3 h-8 w-24" />
      <Skeleton className="mt-2 h-4 w-32" />
    </Card>
  );
}

export function DashboardSummaryStats({ features }: DashboardSummaryStatsProps) {
  const isManager = features.includes("transactions.view");
  const isAdmin = features.includes("users.manage");
  const isOperational =
    features.includes("suppliers.manage") ||
    features.includes("purchases.manage");

  const cardCount = useMemo(() => {
    let count = 0;
    if (isManager) count += 3;
    if (isAdmin) count += 1;
    if (isOperational) count += 2;
    return count;
  }, [isManager, isAdmin, isOperational]);

  const today = getTodayDateInput();
  const defaultRange = getDefaultTransactionDateRange();

  const todaySummary = useTransactionSummaryQuery(
    { period: "daily", dateFrom: today, dateTo: today },
    { enabled: isManager },
  );
  const last30Summary = useTransactionSummaryQuery(
    {
      period: "daily",
      dateFrom: defaultRange.dateFrom,
      dateTo: defaultRange.dateTo,
    },
    { enabled: isManager },
  );
  const usersList = useAdminUsersListQuery(
    { page: 1, perPage: 1 },
    { enabled: isAdmin },
  );
  const suppliersList = useSuppliersListQuery(
    { page: 1, perPage: 1 },
    { enabled: isOperational && features.includes("suppliers.manage") },
  );
  const purchaseRequestsList = usePurchaseRequestsListQuery(
    { page: 1, perPage: 1 },
    { enabled: isOperational && features.includes("purchases.manage") },
  );

  const loading =
    (isManager && (todaySummary.isLoading || last30Summary.isLoading)) ||
    (isAdmin && usersList.isLoading) ||
    (features.includes("suppliers.manage") && suppliersList.isLoading) ||
    (features.includes("purchases.manage") && purchaseRequestsList.isLoading);

  if (cardCount === 0) {
    return null;
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cardCount }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  const todayBuckets = todaySummary.data?.data?.buckets;
  const last30Buckets = last30Summary.data?.data?.buckets;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {isManager && (
        <>
          <StatCard
            label="Today's revenue"
            value={
              todaySummary.isError
                ? PLACEHOLDER
                : formatRupiah(sumBucketAmounts(todayBuckets))
            }
            icon={Banknote}
            color="green"
          />
          <StatCard
            label="Today's transactions"
            value={
              todaySummary.isError
                ? PLACEHOLDER
                : sumBucketCounts(todayBuckets)
            }
            icon={Receipt}
            color="blue"
          />
          <StatCard
            label="Last 30 days revenue"
            value={
              last30Summary.isError
                ? PLACEHOLDER
                : formatRupiah(sumBucketAmounts(last30Buckets))
            }
            icon={TrendingUp}
            color="purple"
          />
        </>
      )}
      {isAdmin && (
        <StatCard
          label="Total users"
          value={
            usersList.isError
              ? PLACEHOLDER
              : (usersList.data?.meta?.total ?? 0)
          }
          icon={Users}
          color="blue"
        />
      )}
      {isOperational && (
        <>
          {features.includes("suppliers.manage") && (
            <StatCard
              label="Suppliers"
              value={
                suppliersList.isError
                  ? PLACEHOLDER
                  : (suppliersList.data?.meta?.total ?? 0)
              }
              icon={Truck}
              color="teal"
            />
          )}
          {features.includes("purchases.manage") && (
            <StatCard
              label="Purchase requests"
              value={
                purchaseRequestsList.isError
                  ? PLACEHOLDER
                  : (purchaseRequestsList.data?.meta?.total ?? 0)
              }
              icon={ShoppingCart}
              color="amber"
            />
          )}
        </>
      )}
    </div>
  );
}
